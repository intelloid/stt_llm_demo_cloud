const express = require("express");
const cors = require("cors"); // CORS 미들웨어 추가

const app = express();
const PORT = 5000;
app.use(cors());

// JSON 파싱 설정
app.use(express.json());

// LLM API 프록시 라우트
app.post("/api/llm", (req, res) => {
  const { text, apiKey } = req.body;
  fetch(`https://medvoice.intelloia.com/api/llm/apiKey?apiKey=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
