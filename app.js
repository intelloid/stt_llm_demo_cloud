"use strict";

var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
var wavesurfer, context, processor;
var ws;
const urlParams = new URLSearchParams(window.location.search);
const langParam = urlParams.get("language");
var webServerURL =
  "wss://nlu-00.intelloia.com:38643/intelloid-STT-stream-web/websocket";
if (langParam) webServerURL = webServerURL + "?language=" + langParam;
let temporaryResult = ""; // PARTIAL 상태일 때의 임시 결과 저장

// show transcribing result text string
// show transcribing result text string
function printSttResult(result, status) {
  var resultElement = document.getElementById("sttresult");

  if (status === "FINAL") {
    // FINAL 상태일 때 고정된 텍스트 추가
    resultElement.style.color = "black";

    // 기존 텍스트에서 PARTIAL 텍스트 제거
    if (temporaryResult) {
      resultElement.value = resultElement.value.replace(temporaryResult, ""); // 이전 PARTIAL 텍스트 제거
    }

    // 최종적으로 FINAL 텍스트 추가 (추가적인 줄바꿈 방지)
    resultElement.value = resultElement.value.trim() + "\n" + result + "\n";

    temporaryResult = ""; // 임시 PARTIAL 결과 초기화
    resultElement.scrollTop = resultElement.scrollHeight; // 스크롤을 항상 최하단으로 유지
  } else if (status === "PARTIAL") {
    // PARTIAL 상태일 때는 임시로 화면 맨 아래에 보여줌
    resultElement.style.color = "gray";

    // 이전 PARTIAL 텍스트가 이미 있을 경우 이를 먼저 제거
    if (temporaryResult) {
      resultElement.value = resultElement.value.replace(temporaryResult, "");
    }

    temporaryResult = result; // 임시 PARTIAL 결과 업데이트

    // PARTIAL 텍스트를 기존 텍스트 아래에 추가
    resultElement.value = resultElement.value.trim() + "\n" + temporaryResult;
    resultElement.scrollTop = resultElement.scrollHeight; // 스크롤을 항상 최하단으로 유지
  } else if (status === "FINAL_A1") {
    // FINAL_A1 상태의 결과 고정
    resultElement.style.color = "blue";

    // 기존 텍스트에 FINAL_A1 상태 텍스트 추가
    if (temporaryResult) {
      resultElement.value = resultElement.value.replace(temporaryResult, ""); // 이전 PARTIAL 텍스트 제거
    }

    resultElement.value = resultElement.value.trim() + "\n" + result + "\n";

    temporaryResult = ""; // 임시 PARTIAL 결과 초기화
    resultElement.scrollTop = resultElement.scrollHeight; // 스크롤을 항상 최하단으로 유지
  }
}

// LLM 분석 결과 출력 함수
function printLLMResult(llmText) {
  var llmResultElement = document.getElementById("llmresult");
  llmResultElement.value = "LLM analysis result: \n" + llmText;
  llmResultElement.scrollTop = llmResultElement.scrollHeight; // 스크롤을 항상 최하단으로 유지
}

// LLM API 호출 함수
function sendSttResultForLLMAnalysis(sttText) {
  fetch("/api/dent_summary", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: sttText,
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
      if (data && data.result) {
        printLLMResult(data.result); // 요약 결과 출력
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
  sttResult.value = ""; // STT 결과 초기화
  llmResult.value = ""; // LLM 결과 초기화
  console.log("STT and LLM results cleared");
}

// Init & load
document.addEventListener("DOMContentLoaded", function () {
  var micBtn = document.querySelector("#micBtn");
  var sttResult = document.getElementById("sttresult");
  var llmResult = document.getElementById("llmresult");

  micBtn.onclick = function () {
    // 마이크가 켜질 때 STT와 LLM 초기화
    clearResults();

    if (wavesurfer === undefined) {
      if (isSafari) {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext({
          sampleRate: 16000,
        });
        processor = context.createScriptProcessor(4096, 1, 1);
      }

      // Init wavesurfer
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
      ws.onmessage = function (event) {
        if (event.data != "") {
          console.info(event.data);
          const obj = JSON.parse(event.data);
          if (
            obj.status == "FINAL" ||
            obj.status == "PARTIAL" ||
            obj.status == "FINAL_A1"
          ) {
            if (obj.results[0].sentence != 0) {
              var trimmedResult = obj.results[0].sentence.trim();
              printSttResult(trimmedResult, obj.status);
              console.info(trimmedResult);
              console.log("test", obj);

              if (trimmedResult.includes("stop")) {
                console.log("Condition met: 'stop' found in sentence.");
                printLLMResult("Converting...");
                micBtn.click(); // 마이크 중지
              }
            }
          }
        }
      };

      wavesurfer.microphone.on("pcmReady", function (b64) {
        ws.send(b64);
      });

      wavesurfer.microphone.on("deviceError", function (code) {
        console.warn("Device error: " + code);
      });
      wavesurfer.on("error", function (e) {
        console.warn(e);
      });
      wavesurfer.microphone.start();
    } else {
      // start/stop mic on button click
      if (wavesurfer.microphone.active) {
        wavesurfer.microphone.stop();
        ws.close();
        console.log("Microphone stopped");

        // STT 내용을 LLM API로 전송
        var sttText = sttResult.value.trim();
        if (sttText) {
          sendSttResultForLLMAnalysis(sttText);
        } else {
          console.warn("No STT result to send for LLM analysis.");
        }
      } else {
        wavesurfer.microphone.start();

        console.log("Microphone started");

        ws = new WebSocket(webServerURL);
        ws.onmessage = function (event) {
          if (event.data != "") {
            console.info(event.data);
            const obj = JSON.parse(event.data);
            if (
              obj.status == "FINAL" ||
              obj.status == "PARTIAL" ||
              obj.status == "FINAL_A1"
            ) {
              if (obj.results[0].sentence != "")
                printSttResult(obj.results[0].sentence, obj.status);

              printLLMResult("This is an example of LLM analysis output.");
            }
          }
        };
      }
    }
  };
});
