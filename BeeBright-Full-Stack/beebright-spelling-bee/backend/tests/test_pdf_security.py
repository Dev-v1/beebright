import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.auth import get_current_admin_user_id
from app.services.pdf_parser import parse_pdf


def sample_pdf():
    content=b'BT /F1 12 Tf 72 720 Td (bee) Tj 0 -20 Td (sky) Tj ET'
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
             b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
             b'<< /Length '+str(len(content)).encode()+b' >>\nstream\n'+content+b'\nendstream',
             b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    result=b'%PDF-1.4\n';offsets=[0]
    for i,obj in enumerate(objects,1):
        offsets.append(len(result));result+=str(i).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
    xref=len(result);result+=b'xref\n0 6\n0000000000 65535 f \n'
    for offset in offsets[1:]:result+=f'{offset:010d} 00000 n \n'.encode()
    return result+b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+str(xref).encode()+b'\n%%EOF\n'


class PdfBoundaryTests(unittest.TestCase):
    def test_valid_word_pdf_survives_dependency_updates(self):
        self.assertEqual(parse_pdf(sample_pdf()),{'random':['bee','sky']})

    def test_non_admin_cannot_invoke_pdf_parser(self):
        with patch('app.main.parse_pdf') as parser:
            response=TestClient(app).post('/api/admin/word-lists/import',files={'file':('test.pdf',sample_pdf(),'application/pdf')})
            self.assertEqual(response.status_code,401);parser.assert_not_called()

    def test_parser_errors_do_not_expose_internal_paths(self):
        app.dependency_overrides[get_current_admin_user_id]=lambda:'test-admin'
        try:
            with patch('app.main.parse_pdf',side_effect=ValueError('/private/server/secret-path')):
                response=TestClient(app).post('/api/admin/word-lists/import',files={'file':('bad.pdf',b'%PDF-bad','application/pdf')})
                self.assertEqual(response.status_code,422)
                self.assertNotIn('secret-path',response.text)
        finally:app.dependency_overrides.pop(get_current_admin_user_id,None)
