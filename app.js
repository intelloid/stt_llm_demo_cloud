"use strict";

var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
var wavesurfer, context, processor;
var ws;
const urlParams = new URLSearchParams(window.location.search);
const langParam = urlParams.get("language");
let apiKey = "";
let temporaryResult = ""; // PARTIAL 상태일 때의 임시 결과 저장

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

// LLM API 호출 함수
function sendSttResultForLLMAnalysis(sttText) {
  fetch("http://localhost:5000/api/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: sttText,
      apiKey: apiKey,
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

// Init & load
document.addEventListener("DOMContentLoaded", async function () {
  var micBtn = document.querySelector("#micBtn");
  var sttResult = document.getElementById("sttresult");

  micBtn.onclick = function () {
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
        sendSttResultForLLMAnalysis(sttText);
      } else {
        console.warn("No STT result to send for LLM analysis.");
      }
    } else {
      startMicrophoneAndWebSocket();
    }
  };
});

// WebSocket 연결 함수
function startMicrophoneAndWebSocket() {
  let webServerURL = `wss://medvoice.intelloia.com/api/stt/apiKey?apiKey=${apiKey}`;
  if (langParam) webServerURL += `&language=${langParam}`;

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

    ws.onopen = function () {
      console.log("WebSocket connection opened.");
      wavesurfer.microphone.on("pcmReady", function (b64) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(b64);
        } else {
          console.warn("WebSocket is not open. Unable to send data.");
        }
      });
    };

    ws.onmessage = function (event) {
      if (event.data != "") {
        console.info(event.data);
        const obj = JSON.parse(event.data);
        if (
          obj.status === "FINAL" ||
          obj.status === "PARTIAL" ||
          obj.status === "FINAL_A1"
        ) {
          if (obj.results[0].sentence != "") {
            var trimmedResult = obj.results[0].sentence.trim();
            printSttResult(trimmedResult, obj.status);
            console.info(trimmedResult);

            if (trimmedResult.includes("stop")) {
              console.log("Condition met: 'stop' found in sentence.");
              printLLMResult("Converting...");
              micBtn.click();
            }
          }
        }
      }
    };

    wavesurfer.microphone.start();
  }
}
