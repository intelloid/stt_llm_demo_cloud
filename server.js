const express = require("express");
const path = require("path");
const fetch = require("node-fetch"); // Node.js의 fetch를 사용하기 위해 node-fetch 설치 필요

const app = express();
const PORT = 23006;

// POST 요청을 처리하기 위한 미들웨어 설정
app.use(express.json());

// static 파일 경로 설정
app.use(express.static(path.join(__dirname)));

// 기본으로 index.html 제공
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 외부 API에 대한 프록시 역할을 하는 API 경로 추가
app.post("/api/dent_summary", async (req, res) => {
  const { text } = req.body;

  try {
    console.log("Received text:", text);

    // 외부 API로 POST 요청 보내기
    console.log("Sending request to external API...");
    const response = await fetch(
      "http://app-00.intelloia.com:13008/dent_summary",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );

    console.log("Response status:", response.status);

    // 응답을 텍스트로 받아오기
    const responseText = await response.text();
    console.log("External API response:", responseText);

    // 응답을 JSON으로 파싱 시도
    try {
      const data = JSON.parse(responseText);
      console.log("Parsed JSON:", data);
      res.status(response.status).json(data); // JSON 파싱 성공 시 JSON 데이터 반환
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError);
      res.status(response.status).send(responseText); // JSON이 아닐 경우 원본 텍스트 반환
    }
  } catch (error) {
    // 에러 디버깅을 위한 추가 로그
    console.error("Error type:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // 500 에러 응답
    res
      .status(500)
      .json({ error: "An error occurred while processing the request." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
