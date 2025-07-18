'use client';

import {
	DrawingUtils,
	FaceLandmarker,
	FilesetResolver,
} from '@mediapipe/tasks-vision';
import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';

export default function FaceLandmarks() {
	const [faceData, setFaceData] = useState([]);
	const [blendShapes, setBlendShapes] = useState([]);
	const webcamRef = useRef(null);
	const canvasRef = useRef(null);
	const landmarkerRef = useRef(null);
	const drawingUtilsRef = useRef(null);
	const [isRecording, setIsRecording] = useState(false);
	const [mediaRecorder, setMediaRecorder] = useState(null);
	const [recordedChunks, setRecordedChunks] = useState([]);
	const [downloadUrl, setDownloadUrl] = useState(null);
	const offscreenCanvasRef = useRef(null);

	useEffect(() => {
		const createFaceLandmarker = async () => {
			const vision = await FilesetResolver.forVisionTasks(
				'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
			);
			const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath: `./models/face_landmarker.task`,
					delegate: 'GPU',
				},
				outputFaceBlendshapes: true, // Ensure blend shapes are enabled
				runningMode: 'VIDEO',
				numFaces: 1,
			});
			landmarkerRef.current = faceLandmarker;
			console.log('Face landmarker is created!');
			capture();
		};
		createFaceLandmarker();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const capture = async () => {
		if (webcamRef.current && landmarkerRef.current && webcamRef.current.video) {
			const video = webcamRef.current.video;
			if (video.currentTime > 0) {
				const result = await landmarkerRef.current.detectForVideo(
					video,
					performance.now()
				);

				if (result.faceLandmarks) {
					setFaceData(result.faceLandmarks);
				}
				if (result.faceBlendshapes) {
					setBlendShapes(result.faceBlendshapes);
				} else {
					console.log('No blend shapes detected'); // Log if no blend shapes
				}
			}
		}
		requestAnimationFrame(capture);
	};

	useEffect(() => {
		const ctx = canvasRef.current.getContext('2d');
		drawingUtilsRef.current = new DrawingUtils(ctx);
	}, []);

	useEffect(() => {
		const ctx = canvasRef.current.getContext('2d');
		if (drawingUtilsRef.current) {
			ctx.clearRect(0, 0, 1280, 720);
			for (const face of faceData) {
				drawingUtilsRef.current.drawConnectors(
					face,
					FaceLandmarker.FACE_LANDMARKS_TESSELATION,
					{ color: '#C0C0C070', lineWidth: 1 }
				);
				drawingUtilsRef.current.drawConnectors(
					face,
					FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
					{ color: '#FF3030', lineWidth: 3 }
				);
				drawingUtilsRef.current.drawConnectors(
					face,
					FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
					{ color: '#FF3030', lineWidth: 3 }
				);
				drawingUtilsRef.current.drawConnectors(
					face,
					FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
					{ color: '#30FF30', lineWidth: 3 }
				);
				drawingUtilsRef.current.drawConnectors(
					face,
					FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
					{ color: '#30FF30', lineWidth: 3 }
				);
				drawingUtilsRef.current.drawConnectors(
					face,
					FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
					{ color: '#E0E0E0', lineWidth: 3 }
				);
				drawingUtilsRef.current.drawConnectors(
					face,
					FaceLandmarker.FACE_LANDMARKS_LIPS,
					{ color: '#E0E0E0', lineWidth: 2 }
				);
				drawingUtilsRef.current.drawConnectors(
					face,
					FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
					{ color: '#FF3030', lineWidth: 3 }
				);
				drawingUtilsRef.current.drawConnectors(
					face,
					FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
					{ color: '#30FF30', lineWidth: 3 }
				);
			}
		}
	}, [faceData]);

	// Helper to combine webcam and overlay into a single stream
	const getCombinedStream = () => {
		const video = webcamRef.current.video;
		const overlay = canvasRef.current;
		const offscreen = offscreenCanvasRef.current;
		if (!offscreen) return null;
		const ctx = offscreen.getContext('2d');
		ctx.clearRect(0, 0, offscreen.width, offscreen.height);
		ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
		ctx.drawImage(overlay, 0, 0, offscreen.width, offscreen.height);
		return offscreen.captureStream();
	};

	// Draw both video and overlay to offscreen canvas during recording
	useEffect(() => {
		let animationId;
		const draw = () => {
			if (isRecording && webcamRef.current && canvasRef.current && offscreenCanvasRef.current) {
				const video = webcamRef.current.video;
				const overlay = canvasRef.current;
				const offscreen = offscreenCanvasRef.current;
				const ctx = offscreen.getContext('2d');
				ctx.clearRect(0, 0, offscreen.width, offscreen.height);
				ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
				ctx.drawImage(overlay, 0, 0, offscreen.width, offscreen.height);
			}
			animationId = requestAnimationFrame(draw);
		};
		if (isRecording) draw();
		return () => cancelAnimationFrame(animationId);
	}, [isRecording]);

	const startRecording = () => {
		setRecordedChunks([]);
		const stream = getCombinedStream();
		if (!stream) return;
		const recorder = new window.MediaRecorder(stream, { mimeType: 'video/webm' });
		recorder.ondataavailable = (e) => {
			if (e.data.size > 0) setRecordedChunks((prev) => [...prev, e.data]);
		};
		recorder.onstop = () => {
			const blob = new Blob(recordedChunks, { type: 'video/webm' });
			const url = URL.createObjectURL(blob);
			setDownloadUrl(url);
		};
		setMediaRecorder(recorder);
		recorder.start();
		setIsRecording(true);
	};

	const stopRecording = () => {
		if (mediaRecorder) {
			mediaRecorder.stop();
		}
		setIsRecording(false);
	};

	return (
		<section className="container mx-auto px-2 sm:px-4">
			<div className="relative w-full pt-[56.25%] sm:pt-[56.25%] md:pt-[56.25%] max-w-full max-h-[90vh] aspect-video">
				<Webcam
					width="1280"
					height="720"
					mirrored
					id="webcam"
					audio={false}
					videoConstraints={{
						width: 1280,
						height: 720,
						facingMode: 'user',
					}}
					ref={webcamRef}
					className="absolute top-0 left-0 w-full h-full object-cover rounded-lg shadow-md"
				/>
				<canvas
					ref={canvasRef}
					width="1280"
					height="720"
					style={{ transform: 'rotateY(180deg)' }}
					className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none rounded-lg"
				></canvas>
				{/* Offscreen canvas for recording (hidden) */}
				<canvas
					ref={offscreenCanvasRef}
					width="1280"
					height="720"
					style={{ display: 'none' }}
				></canvas>
				<div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto">
					{!isRecording ? (
						<button onClick={startRecording} className="px-4 py-2 bg-green-600 text-white rounded w-full sm:w-auto">Start Recording</button>
					) : (
						<button onClick={stopRecording} className="px-4 py-2 bg-red-600 text-white rounded w-full sm:w-auto">Stop Recording</button>
					)}
					{downloadUrl && (
						<a href={downloadUrl} download="face-recording.webm" className="px-4 py-2 bg-blue-600 text-white rounded w-full sm:w-auto text-center">Download Video</a>
					)}
				</div>
				<ul className="absolute top-2 right-2 max-h-[60vh] w-48 sm:w-64 overflow-y-auto bg-white/80 rounded-lg shadow p-2 text-xs sm:text-sm">
					{blendShapes.length === 0 && <p>No blend shapes detected.</p>}
					{blendShapes.map((blendShapeSet, index) => (
						<div key={index}>
							{blendShapeSet.categories.map((shape, shapeIndex) => (
								<li key={shapeIndex} className="blend-shapes-item flex justify-between items-center py-0.5">
									<span className="blend-shapes-label truncate mr-2">{shape.displayName || shape.categoryName}</span>
									<span
										className="blend-shapes-value inline-block text-right"
										style={{
											width: `calc(${shape.score * 100}% - 80px)`,
											backgroundColor: 'red',
										}}
									>
										{shape.score.toFixed(4)}
									</span>
								</li>
							))}
						</div>
					))}
				</ul>
			</div>
		</section>
	);
}
