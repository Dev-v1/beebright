import os
import unittest
from uuid import uuid4
from unittest.mock import patch
import psycopg
from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from app import classrooms as c
from app.auth import get_current_user_id


class MergeTests(unittest.TestCase):
    def test_retries_do_not_duplicate_answers_or_lower_high_scores(self):
        data={"events":[{"id":"one","word":"bee","correct":True,"at":1}],"games":{"rally":42},"favorites":["bee"]}
        self.assertEqual(len(c.merge_studio(data,data)["events"]),1)
        merged=c.merge_studio(data,{"events":[],"games":{"rally":2},"favorites":[]})
        self.assertEqual(merged["games"]["rally"],42)
        self.assertEqual(merged["favorites"],[])
        self.assertEqual(c.merge_studio(data,{"favorites":["sky"]},True)["favorites"],["bee","sky"])

    def test_invalid_history_is_rejected(self):
        for value in ({"events":"oops"},{"events":[{"word":"bee","correct":True,"at":"bad"}]},{"favorites":[{}]},{"games":{"rally":float("nan")}}):
            with self.assertRaises(HTTPException):
                c.merge_studio({},value)


@unittest.skipUnless(os.environ.get("TEST_DATABASE_URL"),"requires an isolated test database")
class ClassroomIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.connection=patch.object(c,"_connect",lambda:psycopg.connect(os.environ["TEST_DATABASE_URL"]))
        cls.connection.start()
        c.initialize()
        cls.app=FastAPI()
        cls.app.include_router(c.router)
        def user(x_test_user: str = Header(default="")):
            if not x_test_user: raise HTTPException(401,"Sign in")
            return x_test_user
        cls.app.dependency_overrides[get_current_user_id]=user
        cls.client=TestClient(cls.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close();cls.connection.stop()

    def setUp(self):
        self.teacher="test_"+uuid4().hex
        self.student="test_"+uuid4().hex
        self.other="test_"+uuid4().hex

    def call(self,method,path,user=None,**kwargs):
        return self.client.request(method,path,headers={"X-Test-User":user or self.teacher,**kwargs.pop("headers",{})},**kwargs)

    def test_classroom_permissions_join_activity_leave_and_code_rotation(self):
        created=self.call("POST","/api/classrooms",json={"name":"Spelling class"})
        self.assertEqual(created.status_code,201,created.text)
        room=created.json();room_id=room["id"]
        self.assertEqual(len(room["code"]),8)
        self.assertEqual(self.client.get("/api/classrooms").status_code,401)
        for user in (self.student,self.other):
            self.assertEqual(self.call("GET",f"/api/classrooms/{room_id}/students",user).status_code,403)
        self.call("PUT","/api/activity",self.student,json={"screen":"practice"})
        joined=self.call("POST","/api/classrooms/join",self.student,json={"code":room["code"],"display_name":"Student One"})
        self.assertEqual(joined.status_code,200,joined.text)
        self.call("POST","/api/classrooms/join",self.student,json={"code":room["code"],"display_name":"Student One"})
        rows=self.call("GET",f"/api/classrooms/{room_id}/students").json()
        self.assertEqual(len(rows),1);self.assertIsNone(rows[0]["activity"])
        self.call("PUT","/api/activity",self.student,json={"screen":"practice","answered":4,"correct":3,"source":"local"})
        self.assertEqual(self.call("GET",f"/api/classrooms/{room_id}/students").json()[0]["activity"]["source"],"local")
        student_rooms=self.call("GET","/api/classrooms",self.student).json()
        self.assertIsNone(student_rooms[0]["code"])
        self.assertEqual(self.call("DELETE",f"/api/classrooms/{room_id}",self.other).status_code,403)
        newcode=self.call("POST",f"/api/classrooms/{room_id}/rotate-code").json()["code"]
        self.assertNotEqual(newcode,room["code"])
        self.assertEqual(self.call("POST","/api/classrooms/join",self.other,json={"code":room["code"],"display_name":"No"}).status_code,404)
        self.assertEqual(self.call("DELETE",f"/api/classrooms/{room_id}/members/{self.student}",self.other).status_code,403)
        self.call("DELETE",f"/api/classrooms/{room_id}/members/{self.student}",self.student)
        self.assertEqual(self.call("GET",f"/api/classrooms/{room_id}/students").json(),[])
        self.call("DELETE",f"/api/classrooms/{room_id}")

    def test_studio_is_account_scoped_and_retry_safe(self):
        data={"events":[{"id":"answer","word":"bee","correct":True,"at":1}],"favorites":["bee"]}
        for _ in range(2):
            response=self.call("PUT","/api/account/studio",self.student,json={"data":data})
            self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(len(self.call("GET","/api/account/studio",self.student).json()["events"]),1)
        self.assertEqual(self.call("GET","/api/account/studio",self.other).json(),{})
        self.assertEqual(self.call("PUT","/api/account/studio",json={"data":{"events":"bad"}}).status_code,422)

    def test_pairing_requires_browser_approval_expires_and_revokes(self):
        c._attempts.clear()
        pair=self.client.post("/api/devices/start").json()
        with self.assertRaises(HTTPException): c.device_user(pair["token"])
        response=self.call("POST","/api/devices/approve",json={"code":pair["code"]})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(c.device_user(pair["token"]),self.teacher)
        self.assertEqual(self.call("POST","/api/devices/approve",json={"code":pair["code"]}).status_code,400)
        with c._connect() as db:
            row=db.execute("SELECT token_hash FROM desktop_sessions WHERE code=%s",(pair["code"],)).fetchone()
            self.assertNotEqual(row[0],pair["token"])
        self.call("DELETE","/api/devices/current",headers={"Authorization":"Bearer "+pair["token"]})
        with self.assertRaises(HTTPException): c.device_user(pair["token"])

    def test_pairing_rate_limit_and_blank_class_names(self):
        self.assertEqual(self.call("POST","/api/classrooms",json={"name":"   "}).status_code,422)
        c._attempts.clear()
        for _ in range(10): self.assertEqual(self.client.post("/api/devices/start").status_code,201)
        self.assertEqual(self.client.post("/api/devices/start").status_code,429)
        c._attempts.clear()
