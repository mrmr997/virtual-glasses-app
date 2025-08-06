import React, { useEffect, useRef, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import "./App.css";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const glassesImagesRef = useRef([]);

  // JSONから画像ファイル名を読み込む
  const [glassesList, setGlassesList] = useState([]);
  const [selectedGlassesIndex, setSelectedGlassesIndex] = useState(0);
  const selectedGlassesIndexRef = useRef(selectedGlassesIndex);

  // 選択状態をrefにも同期
  useEffect(() => {
    selectedGlassesIndexRef.current = selectedGlassesIndex;
  }, [selectedGlassesIndex]);

  // JSONから画像リスト取得（先頭に"無し"を追加）
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

  // メガネ画像を先読み
  useEffect(() => {
    if (glassesList.length === 0) return;
    glassesImagesRef.current = glassesList.map((src) => {
      if (!src) return null;
      const img = new Image();
      img.src = src;
      return img;
    });
  }, [glassesList]);

  // 顔の検出と描画
  const onResults = (results) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

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

      // 👇 「無し」や画像未読込みの場合は描画スキップ
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

  // カメラとFaceMeshの初期化
  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
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
        <canvas ref={canvasRef} width="640" height="480" />
      </div>

      <div className="buttons">
         {glassesList.map((src, idx) => {
           const filename = src.split("/").pop();
           const name = idx === 0 ? "無し" : filename?.split(".").slice(0, -1).join(".") || `メガネ${idx}`;
          return (
            <button
              key={idx}
              onClick={() => setSelectedGlassesIndex(idx)}
              className={selectedGlassesIndex === idx ? "active" : ""}
              style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
            >
              {idx !== 0 ? (
                <img
                  src={src}
                  alt={name}
                  style={{ width: "60px", height: "auto", marginBottom: "4px" }}
                />
              ) : (
                <div
                  style={{
                    width: "60px",
                    height: "40px",
                    marginBottom: "4px",
                    background: "#ccc",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                  }}
                >
                  ✖
                </div>
              )}
              <span>{name}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
}

export default App;
