import React, { useEffect, useRef, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { Button, Stack ,Box} from "@mui/material"; // ← MUIのコンポーネントを追加
import "./App.css";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const glassesImagesRef = useRef([]);

  const [glassesList, setGlassesList] = useState([]);
  const [selectedGlassesIndex, setSelectedGlassesIndex] = useState(0);
  const selectedGlassesIndexRef = useRef(selectedGlassesIndex);
  const [showButtons, setShowButtons] = useState(false);
  const [isWide, setIsWide] = useState(window.innerWidth > 600);

  // 画面幅の監視
  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth > 600);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    selectedGlassesIndexRef.current = selectedGlassesIndex;
  }, [selectedGlassesIndex]);

  useEffect(() => {
    fetch("/glassesList.json")
      .then((res) => res.json())
      .then((data) => {
        setGlassesList(["", ...data.map((filename) => "/" + filename)]);
      })
      .catch((err) => {
        console.error("画像リストの読み込みエラー", err);
      });
  }, []);

  useEffect(() => {
    if (glassesList.length === 0) return;
    glassesImagesRef.current = glassesList.map((src) => {
      if (!src) return null;
      const img = new Image();
      img.src = src;
      return img;
    });
  }, [glassesList]);

  const onResults = (results) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const scale = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth * scale;
    const displayHeight = canvas.clientHeight * scale;
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (
      results.multiFaceLandmarks &&
      results.multiFaceLandmarks.length > 0 &&
      glassesImagesRef.current.length > 0
    ) {
      const landmarks = results.multiFaceLandmarks[0];
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];

      const centerX = ((leftEye.x + rightEye.x) / 2) * canvas.width;
      const centerY = ((leftEye.y + rightEye.y) / 2) * canvas.height;

      const dx = (rightEye.x - leftEye.x) * canvas.width;
      const dy = (rightEye.y - leftEye.y) * canvas.height;
      const angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);

      const img = glassesImagesRef.current[selectedGlassesIndexRef.current];
      if (!img || !img.complete) return;

      const imgWidth = distance * 1.8;
      const imgHeight = imgWidth * (img.height / img.width);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      ctx.restore();
    }
  };

  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            aspectRatio: 9 / 16,
            facingMode: "user",
            width: { ideal: 720 },
            height: { ideal: 1280 },
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const faceMesh = new FaceMesh({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults(onResults);

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            await faceMesh.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
          frameRate: 30,
        });

        camera.start();
      } catch (err) {
        console.error("カメラの起動に失敗しました:", err);
      }
    };

    start();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="container">
      <h1>👓 バーチャルメガネ試着アプリ</h1>

      <div className="video-area">
        <video ref={videoRef} style={{ display: "none" }} playsInline muted />
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
        <Button
          id="glasses-change-button"
          variant="contained"
          onClick={() => setShowButtons(!showButtons)}
          sx={{
            display: { xs: "block", md: "none" },
            position: "fixed",
            bottom: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            width: "180px",
            textAlign: "center",
            backgroundColor: "#f06292",
            transition:"none"
          }}
        >
          {showButtons ? "閉じる" : "メガネ変更"}
        </Button>

        <Stack
          id="glasses-stack"
          direction="row"
          spacing={2}
          mt={2}
          flexWrap="wrap"
          justifyContent="center"
          sx={{
            position: { xs: "static", md: "static" },
            bottom: "auto",
            left: "auto",
            transform: "none",
            backgroundColor: { xs: "rgba(255,255,255,0.95)", md: "transparent" },
            padding: { xs: "0.75rem", md: 0 },
            borderRadius: { xs: 2, md: 0 },
            boxShadow: { xs: 3, md: 0 },
          }}
          style={{
            visibility: showButtons || isWide ? "visible" : "hidden",
            opacity: showButtons || isWide ? 1 : 0,
          }}
        >
          {/* ... */}
        </Stack>
      </div>

      {/* MUI Stackでボタンを横並びに美しく配置 */}
      {(showButtons || isWide) && (
        <Stack
          direction="row"
          spacing={2}
          mt={2}
          flexWrap="wrap"
          justifyContent="center"
          sx={{
            position: { xs: "fixed", md: "static" },
            bottom: { xs: "4.5rem", md: "auto" },
            left: { xs: "50%", md: "auto" },
            transform: { xs: "translateX(-50%)", md: "none" },
            zIndex: 9,
            backgroundColor: { xs: "rgba(255,255,255,0.95)", md: "transparent" },
            padding: { xs: "0.75rem", md: 0 },
            borderRadius: { xs: 2, md: 0 },
            boxShadow: { xs: 3, md: 0 },
          }}
        >
          {glassesList.map((src, idx) => {
            const filename = src.split("/").pop();
            const name =
              idx === 0
                ? "無し"
                : filename?.split(".").slice(0, -1).join(".") || `メガネ${idx}`;

            return (
              <Button
                key={idx}
                variant={selectedGlassesIndex === idx ? "contained" : "outlined"}
                color="primary"
                onClick={() => setSelectedGlassesIndex(idx)}
              >
                {name}
              </Button>
            );
          })}
        </Stack>
      )}
    </div>
  );
}

export default App;
