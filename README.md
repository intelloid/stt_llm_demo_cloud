# intelloid STT Stream Websocket Example
This is a STT stream API web-page example for testing.
 
# How To Install and Run the Project
1. Clone the repo to your local machine.
2. (Check webServerURL address of [app.js](./app.js#L6))
3. All you need is a webserver. If you own your (static) webserver to serve your_local_repo_root, start it and jump to step 7.
4. Or install a good "ready-to-use" Node.js http-server. `npm install http-server -g`
5. `cd your_local_repo_root`
6. Start the server with the command. `http-server -a localhost -p 80`
7. Start web browser and click button, we will start dictation & displaying the text.

### important!
* Web page URL address must be localhost or 127.0.0.1 or https://... for microphone input because of [security reason](https://www.chromium.org/Home/chromium-security/marking-http-as-non-secure).
