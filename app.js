"use strict";

var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
var wavesurfer, context, processor;
var ws;
const urlParams = new URLSearchParams(window.location.search);
const langParam = urlParams.get("language");
let accessToken =
  "eyJhbGciOiJIUzUxMiJ9.eyJ0eXBlIjoibWFpbiIsInVzZXJJZCI6IjE5IiwiYXV0aG9yaXRpZXMiOiJVU0VSIiwiaXNzIjoiSW50ZWxsb2lkIiwiaWF0IjoxNzI5ODE1ODMyLCJleHAiOjE3Mjk4NTE4MzJ9.9OzWCdR1TBwc0B_PTICYoJK_0sUjhbIg1nmhZlpxOQRwBHnmjSHOHxYEsbIcAQym_fXgIgYOyw8gxul_utBvgA";
let userId = 19;
let sttToken;
let webServerURL = `wss://medvoice.intelloia.com/api/stt?token=${sttToken}`;
let temporaryResult = ""; // PARTIAL 상태일 때의 임시 결과 저장
let llmToken;

if (langParam) webServerURL = webServerURL + "?language=" + langParam;

// STT 결과 출력 함수
function printSttResult(result, status) {
  var resultElement = document.getElementById("sttresult");

  if (status === "FINAL") {
    resultElement.style.color = "black";
    if (temporaryResult) {
      resultElement.value = resultElement.value.replace(temporaryResult, "");
    }
    resultElement.value = resultElement.value.trim() + "\n" + result + "\n";
    temporaryResult = "";
    resultElement.scrollTop = resultElement.scrollHeight;
  } else if (status === "PARTIAL") {
    resultElement.style.color = "gray";
    if (temporaryResult) {
      resultElement.value = resultElement.value.replace(temporaryResult, "");
    }
    temporaryResult = result;
    resultElement.value = resultElement.value.trim() + "\n" + temporaryResult;
    resultElement.scrollTop = resultElement.scrollHeight;
  } else if (status === "FINAL_A1") {
    resultElement.style.color = "blue";
    if (temporaryResult) {
      resultElement.value = resultElement.value.replace(temporaryResult, "");
    }
    resultElement.value = resultElement.value.trim() + "\n" + result + "\n";
    temporaryResult = "";
    resultElement.scrollTop = resultElement.scrollHeight;
  }
}

// LLM 분석 결과 출력 함수
function printLLMResult(llmText) {
  var llmResultElement = document.getElementById("llmresult");
  llmResultElement.value = "LLM analysis result: \n" + llmText;
  llmResultElement.scrollTop = llmResultElement.scrollHeight;
}

// app.js - LLM API 호출 함수
function sendSttResultForLLMAnalysis(sttText) {
  fetch("http://localhost:5000/api/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: sttText,
      llmToken: llmToken,
    }),
  })
    .then((response) => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error("LLM analysis failed.");
      }
    })
    .then((data) => {
      console.log(data);
      if (data && data.result) {
        printLLMResult(data.result);
      } else {
        printLLMResult("LLM analysis failed.");
      }
    })
    .catch((error) => {
      console.error("Error during LLM analysis:", error);
      printLLMResult("Error during LLM analysis.");
    });
}

// STT와 LLM 결과 초기화 함수
function clearResults() {
  var sttResult = document.getElementById("sttresult");
  var llmResult = document.getElementById("llmresult");
  sttResult.value = "";
  llmResult.value = "";
  console.log("STT and LLM results cleared");
}

// STT 토큰 받기 함수 (async)
async function getSTTToken() {
  try {
    const response = await fetch("http://localhost:5000/api/auth/token/stt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: accessToken,
        userId: userId,
      }),
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      sttToken = data.sttToken;
      console.log("STT Token:", sttToken);
      return sttToken;
    } else {
      throw new Error("Invalid response format");
    }
  } catch (error) {
    console.error("Error getting STT Token:", error);
    return null;
  }
}

// LLM 토큰 받기 함수 (async)
async function getLLMToken() {
  try {
    const response = await fetch("http://localhost:5000/api/auth/token/llm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: accessToken,
        userId: userId,
      }),
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      llmToken = data.llmToken;
      console.log("LLM Token:", llmToken);
      return llmToken;
    } else {
      throw new Error("Invalid response format");
    }
  } catch (error) {
    console.error("Error getting LLM Token:", error);
    return null;
  }
}

// Init & load
document.addEventListener("DOMContentLoaded", async function () {
  var micBtn = document.querySelector("#micBtn");
  var sttResult = document.getElementById("sttresult");
  var llmResult = document.getElementById("llmresult");

  try {
    const [sttTokenResult, llmTokenResult] = await Promise.all([
      getSTTToken(),
      getLLMToken(),
    ]);

    if (sttTokenResult && llmTokenResult) {
      console.log("Both tokens received. Ready to start WebSocket.");

      micBtn.onclick = function () {
        // 마이크가 활성화된 상태라면 멈추고 LLM 요청을 보냄
        if (wavesurfer && wavesurfer.microphone.active) {
          wavesurfer.microphone.stop();

          // WebSocket 닫기 전에 상태 확인
          if (
            ws &&
            (ws.readyState === WebSocket.OPEN ||
              ws.readyState === WebSocket.CONNECTING)
          ) {
            ws.close();
            console.log("WebSocket connection closed.");
          }

          var sttText = sttResult.value.trim();
          if (sttText) {
            // STT 결과가 있을 때 LLM 분석 요청
            sendSttResultForLLMAnalysis(sttText);
          } else {
            console.warn("No STT result to send for LLM analysis.");
          }
        } else {
          startMicrophoneAndWebSocket(sttTokenResult);
        }
      };
    } else {
      console.error("Failed to get required tokens.");
    }
  } catch (error) {
    console.error("Error initializing tokens:", error);
  }
});

// WebSocket 연결 함수
function startMicrophoneAndWebSocket(sttToken) {
  let webServerURL = `wss://medvoice.intelloia.com/api/stt?token=${sttToken}`;

  // 기존 WebSocket이 열려 있으면 다시 열지 않도록 처리
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    console.log("WebSocket is already open or connecting.");
    return;
  }

  if (wavesurfer === undefined) {
    if (isSafari) {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext({
        sampleRate: 16000,
      });
      processor = context.createScriptProcessor(4096, 1, 1);
    }

    wavesurfer = WaveSurfer.create({
      container: "#waveform",
      waveColor: "black",
      interact: false,
      cursorWidth: 0,
      audioContext: context || null,
      audioScriptProcessor: processor || null,
      plugins: [
        WaveSurfer.microphone.create({
          bufferSize: 4096,
          numberOfInputChannels: 1,
          numberOfOutputChannels: 1,
          constraints: {
            video: false,
            audio: true,
          },
        }),
      ],
    });

    wavesurfer.microphone.on("deviceReady", function (stream) {
      console.info("Device ready!", stream);
    });

    ws = new WebSocket(webServerURL);

    // WebSocket이 열렸을 때
    ws.onopen = function () {
      console.log("WebSocket connection opened.");
      // WebSocket이 열렸을 때부터 데이터를 전송할 수 있음
      wavesurfer.microphone.on("pcmReady", function (b64) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(b64); // WebSocket이 열렸을 때만 데이터를 전송
        } else {
          console.warn("WebSocket is not open. Unable to send data.");
        }
      });
    };

    ws.onclose = function (event) {
      console.log("WebSocket closed:", event);
    };

    ws.onerror = function (error) {
      console.error("WebSocket error:", error);
    };

    ws.onmessage = function (event) {
      if (event.data != "") {
        console.info(event.data);
        const obj = JSON.parse(event.data);
        if (
          obj.status == "FINAL" ||
          obj.status == "PARTIAL" ||
          obj.status == "FINAL_A1"
        ) {
          if (obj.results[0].sentence != "") {
            var trimmedResult = obj.results[0].sentence.trim();
            printSttResult(trimmedResult, obj.status);
            console.info(trimmedResult);

            if (trimmedResult.includes("stop")) {
              console.log("Condition met: 'stop' found in sentence.");
              printLLMResult("Converting...");
              micBtn.click(); // 마이크 중지
            }
          }
        }
      }
    };

    wavesurfer.microphone.on("deviceError", function (code) {
      console.warn("Device error: " + code);
    });

    wavesurfer.on("error", function (e) {
      console.warn(e);
    });

    wavesurfer.microphone.start();
  }
}
