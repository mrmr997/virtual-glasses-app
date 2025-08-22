import React, { useEffect, useRef, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { Button, Stack, Box } from "@mui/material";
import "./App.css";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const glassesImagesRef = useRef([]);

  const [glassesList, setGlassesList] = useState([]);
  const [selectedGlassesIndex, setSelectedGlassesIndex] = useState(0);
  const selectedGlassesIndexRef = useRef(selectedGlassesIndex);
  const [showButtons, setShowButtons] = useState(false);
  const [isWide, setIsWide] = useState(window.innerWidth > 900);

  // ★ 注意事項モーダル用 state
  const [agreed, setAgreed] = useState(false);

  // 画面幅の監視
  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth > 900);
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
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1); // 左右反転
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (
      results.multiFaceLandmarks &&
      results.multiFaceLandmarks.length > 0 &&
      glassesImagesRef.current.length > 0
    ) {
      const landmarks = results.multiFaceLandmarks[0];
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];

      let centerX = ((leftEye.x + rightEye.x) / 2) * canvas.width;
      const centerY = ((leftEye.y + rightEye.y) / 2) * canvas.height;

      centerX = canvas.width - centerX;

      const dx = (rightEye.x - leftEye.x) * canvas.width;
      const dy = (rightEye.y - leftEye.y) * canvas.height;
      const angle = -Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);

      const img = glassesImagesRef.current[selectedGlassesIndexRef.current];
      if (!img || !img.complete) return;

      const imgWidth = distance * 1.6;
      const imgHeight = imgWidth * (img.height / img.width);

      ctx.save();
      const offsetY = distance * 0.05;
      ctx.translate(centerX, centerY + offsetY);
      ctx.rotate(angle);
      ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      ctx.restore();
    }
  };

  // ★ 常にカメラ起動
  useEffect(()=>{
      if(!agreed)return//同意するまで起動しない

      const start = async ()=>{
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            aspectRatio: 3 / 4,
            facingMode: "user",
            width: { ideal: 1080 },
            height: { ideal: 1920 },
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
  }, [agreed]);

  return (
    <div className="container">
      {/* ★ 注意事項モーダル */}
      {!agreed && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.8)",
            color: "#000",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
            padding: 3,
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              backgroundColor: "#fff",
              borderRadius: 3,
              padding: 3,
              maxWidth: "600px",
              maxHeight: "80vh",
              overflowY: "auto",
              textAlign: "left",
            }}
          >
            <h2 style={{ textAlign: "center" }}>ご利用規約・同意事項</h2>
            <p style={{ fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-line" }}>
{`本アプリをご利用いただく前に、以下の規約をよくお読みください。
本アプリを利用された場合、以下の内容に同意いただいたものとみなします。

第1条（目的）
本アプリは、メガネの仮想試着体験を提供することを目的としています。
購入時の参考体験としてご利用いただくものであり、実際の商品と完全に一致することを保証するものではありません。

第2条（利用環境）
本アプリは一部の端末・OS環境において、正常に動作しない場合があります。
通信状況や端末性能により、表示の遅延・不具合が生じる可能性があります。

第3条（個人情報の取り扱い）
本アプリは試着体験のため、カメラ機能を使用します。
撮影画像・映像は端末内で処理され、当社サーバー等に送信・保存されることはありません。
ユーザーのプライバシー保護に十分配慮して運営します。

第4条（禁止事項）
ユーザーは、本アプリの利用にあたり、以下の行為を行ってはなりません。
- 本アプリを不正に改変・解析する行為
- 他者を誹謗中傷したり、不快にさせる目的で利用する行為
- 法令または公序良俗に反する行為

第5条（免責事項）
本アプリの利用により発生したトラブル・損害・不利益について、当社は一切の責任を負いません。
本アプリの表示内容（色・サイズ等）は実物と異なる場合があります。ご検討の際の目安としてご活用ください。
当社は予告なく本アプリの提供を中断・停止する場合があります。

第6条（規約の変更）
当社は、必要に応じて本規約を変更できるものとします。変更後の規約は、アプリ内または当社サイトに掲載した時点で効力を生じるものとします。

第7条（お問い合わせ）
本アプリに関するご質問・ご意見は、下記までご連絡ください。

伊藤光学工業株式会社
〒4430041 愛知県蒲郡市宮成町３番１９号
cloudfunding@itohopt.co.jp`}
            </p>
            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setAgreed(true)}
              >
                同意して始める
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      <h1>バーチャルメガネ試着アプリ</h1>

      {/* カメラ・キャンバスは常に表示 */}
      <div className="video-area">
        <video ref={videoRef} style={{ display: "none" }} playsInline muted />
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
        <div className="video-overlay">レンズ・フレームは実物と異なる場合があります<br />カメラ映像はリアルタイム処理のみで、撮影や保存は一切行いません</div>
        
      </div>

      {/* スマホだけ表示：メガネ変更・閉じるボタン */}
      {agreed && (
        <Box
          sx={{
            display: { xs: "block", md: "none" },
            position: "fixed",
            bottom: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            width: "180px",
            textAlign: "center",
            zIndex: 1500,
          }}
        >
          {!showButtons && (
            <Button
              variant="contained"
              sx={{ width: "100%", backgroundColor: "#f06292" }}
              onClick={() => setShowButtons(true)}
            >
              メガネ変更
            </Button>
          )}
          {showButtons && (
            <Button
              variant="contained"
              sx={{ width: "100%", backgroundColor: "#f06292" }}
              onClick={() => setShowButtons(false)}
            >
              閉じる
            </Button>
          )}
        </Box>
      )}

      {/* メガネ選択ボタン群 */}
      {agreed && (showButtons || isWide) && (
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          flexWrap="wrap"
          justifyContent="center"
          sx={{
            position: { xs: "fixed", md: "static" },
            bottom: { xs: "4.5rem", md: "auto" },
            left: { xs: "50%", md: "auto" },
            transform: { xs: "translateX(-50%)", md: "none" },
            zIndex: 1400,
            backgroundColor: { xs: "rgba(255,255,255,0.95)", md: "transparent" },
            padding: { xs: "0.75rem", md: 0 },
            borderRadius: { xs: 2, md: 0 },
            boxShadow: { xs: 3, md: 0 },
            maxWidth: { xs: "95vw", md: "700px" },
            margin: { md: "1rem auto 0 auto" },
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
                sx={{
                  minWidth: { xs: "100%", md: "auto" },
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                }}
                onClick={() => {
                  setSelectedGlassesIndex(idx);
                  if (window.innerWidth <= 900) {
                    setShowButtons(false);
                  }
                }}
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
