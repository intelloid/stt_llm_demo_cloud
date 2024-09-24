"use strict";

var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
var wavesurfer, context, processor;
var ws;
const urlParams = new URLSearchParams(window.location.search);
const langParam = urlParams.get("language");
var webServerURL =
  "wss://nlu-00.intelloia.com:38743/intelloid-STT-stream-web/websocket";
if (langParam) webServerURL = webServerURL + "?language=" + langParam;

//show transcribing result text string
function printSttResult(result, status) {
  var resultElement = document.getElementById("sttresult");
  if (status == "FINAL") {
    resultElement.style.color = "black";
    resultElement.value += result + "\n"; // 기존 텍스트 보존하고 추가하기
    resultElement.scrollTop = resultElement.scrollHeight; // 스크롤을 항상 최하단으로 유지
  } else if (status == "PARTIAL") {
    resultElement.style.color = "gray";
  } else if (status == "FINAL_A1") {
    resultElement.style.color = "blue";
    resultElement.value += result + "\n"; // 기존 텍스트 보존하고 추가하기
    resultElement.scrollTop = resultElement.scrollHeight; // 스크롤을 항상 최하단으로 유지
  }
}

// LLM 분석 결과 출력 함수
function printLLMResult(llmText) {
  var llmResultElement = document.getElementById("llmresult");
  llmResultElement.value = "LLM analysis result: " + llmText;
  llmResultElement.scrollTop = llmResultElement.scrollHeight; // 스크롤을 항상 최하단으로 유지
}

// LLM API 호출 함수
function sendSttResultForLLMAnalysis(sttText) {
  fetch("http://10.10.123.60:22223/dent_summary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: sttText,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data && data.summary) {
        printLLMResult(data.summary); // API에서 반환된 요약을 LLM textarea에 표시
      } else {
        printLLMResult("LLM analysis failed.");
      }
    })
    .catch((error) => {
      console.error("Error during LLM analysis:", error);
      printLLMResult("Error during LLM analysis.");
    });
}

// Init & load
document.addEventListener("DOMContentLoaded", function () {
  var micBtn = document.querySelector("#micBtn");
  var sttResult = document.getElementById("sttresult");
  var llmResult = document.getElementById("llmresult");

  micBtn.onclick = function () {
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
            if (obj.results[0].sentence != "") {
              printSttResult(obj.results[0].sentence, obj.status);
              var result = obj.results[0].sentence;
              console.info(result);
              if (result.includes("stop") == true) micBtn.click();

              // LLM 분석 결과 추가 (예시 텍스트)
              printLLMResult("This is an example of LLM analysis output.");
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

        // STT 내용을 LLM API로 전송
        var sttText = sttResult.value.trim();
        if (sttText) {
          sendSttResultForLLMAnalysis(sttText);
        } else {
          console.warn("No STT result to send for LLM analysis.");
        }
      } else {
        wavesurfer.microphone.start();
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
