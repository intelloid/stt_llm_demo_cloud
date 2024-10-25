const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors"); // CORS 미들웨어 추가

const app = express();
const PORT = 5000;
app.use(cors());

// JSON 파싱 설정
app.use(express.json());

// STT 토큰 API 프록시
app.post("/api/auth/token/stt", (req, res) => {
  const { accessToken, userId } = req.body;

  fetch("https://medvoice.intelloia.com/api/auth/token/stt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      userId: `${userId}`,
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("STT Token request failed");
      }

      // 응답 본문이 있을 때만 JSON으로 변환
      return response.text().then((text) => {
        // 응답 헤더에서 토큰을 전달하기 위해 expose
        res.set("Access-Control-Expose-Headers", "Authorization");
        const sttToken = response.headers.get("Authorization");
        return text ? { sttToken, body: JSON.parse(text) } : { sttToken };
      });
    })
    .then((data) => {
      res.json(data); // 응답 데이터 전송
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(500).send("STT Token request failed");
    });
});

// LLM 토큰 API 프록시
app.post("/api/auth/token/llm", (req, res) => {
  const { accessToken, userId } = req.body;

  fetch("https://medvoice.intelloia.com/api/auth/token/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      userId: `${userId}`,
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("LLM Token request failed");
      }

      return response.text().then((text) => {
        // 응답 헤더에서 토큰을 전달하기 위해 expose
        res.set("Access-Control-Expose-Headers", "Authorization");
        const llmToken = response.headers.get("Authorization");
        return text ? { llmToken, body: JSON.parse(text) } : { llmToken };
      });
    })
    .then((data) => {
      res.json(data); // 응답 데이터 전송
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(500).send("LLM Token request failed");
    });
});
// LLM API 프록시 라우트
app.post("/api/llm", (req, res) => {
  const { text, llmToken } = req.body;

  fetch("https://medvoice.intelloia.com/api/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llmToken}`,
    },
    body: JSON.stringify({ text }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("LLM API request failed");
      }
      return response.json();
    })
    .then((data) => res.json(data)) // 받은 데이터를 그대로 반환
    .catch((error) => {
      console.error("Error in LLM API request:", error);
      res.status(500).json({ error: "LLM analysis failed" });
    });
});
// 서버 실행
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
