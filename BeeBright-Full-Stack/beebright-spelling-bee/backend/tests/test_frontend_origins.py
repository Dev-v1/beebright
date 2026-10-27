"""Explicit frontend origins must agree for Clerk sessions and CORS."""
import time
import unittest
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.config import Settings
from app import auth


class FrontendOriginTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = cls.private_key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()
        cls.settings = Settings(
            _env_file=None,
            frontend_url="https://www.beebright.app/",
            additional_frontend_urls="https://beebright.app, https://beebright.vercel.app/, , https://www.beebright.app",
            clerk_jwt_key=public_key,
            clerk_issuer_url="https://clerk.example.test",
        )

    def token(self, origin, **overrides):
        claims = dict(sub="test-user", azp=origin, iss=self.settings.clerk_issuer_url, exp=int(time.time())+60)
        claims.update(overrides)
        return jwt.encode(claims, self.private_key, algorithm="RS256")

    def test_normalizes_and_deduplicates_only_configured_origins(self):
        self.assertEqual(self.settings.frontend_origins, [
            "http://localhost:5173", "https://www.beebright.app",
            "https://beebright.app", "https://beebright.vercel.app",
        ])

    def test_default_configuration_preserves_local_development(self):
        self.assertEqual(Settings(_env_file=None).frontend_origins, ["http://localhost:5173"])

    def test_clerk_accepts_new_domains_and_existing_vercel_site(self):
        with patch.object(auth, "get_settings", return_value=self.settings):
            auth._public_key.cache_clear()
            try:
                for origin in self.settings.frontend_origins:
                    self.assertEqual(auth.get_current_user_id("Bearer "+self.token(origin)), "test-user")
            finally:
                auth._public_key.cache_clear()

    def test_clerk_rejects_similar_unconfigured_domains_and_bad_signatures(self):
        with patch.object(auth, "get_settings", return_value=self.settings):
            auth._public_key.cache_clear()
            try:
                for origin in ["https://beebright.app.attacker.test", "https://unlisted.beebright.app", "https://evil.test"]:
                    with self.assertRaises(HTTPException):
                        auth.get_current_user_id("Bearer "+self.token(origin))
                with self.assertRaises(HTTPException):
                    auth.get_current_user_id("Bearer "+jwt.encode(
                        dict(sub="test-user", azp="https://www.beebright.app", exp=int(time.time())+60),
                        "wrong-key", algorithm="HS256",
                    ))
            finally:
                auth._public_key.cache_clear()

    def test_cors_accepts_same_allowlist_and_rejects_unknown_origins(self):
        app = FastAPI()
        app.add_middleware(CORSMiddleware, allow_origins=self.settings.frontend_origins, allow_methods=["GET", "PUT"], allow_headers=["Authorization", "Content-Type"])
        client = TestClient(app)
        for origin in self.settings.frontend_origins:
            response = client.options("/api/progress", headers={
                "Origin":origin, "Access-Control-Request-Method":"PUT",
                "Access-Control-Request-Headers":"authorization,content-type",
            })
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["access-control-allow-origin"], origin)
        response = client.options("/api/progress", headers={"Origin":"https://evil.test","Access-Control-Request-Method":"PUT"})
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)


if __name__ == "__main__":
    unittest.main()
