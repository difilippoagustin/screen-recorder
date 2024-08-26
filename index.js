let isRecording = false;
let videoRecorder;
let videoStream;
let audioStream;

const audioBitsRates = [
	{ text: "64 kbps", value: 64000, description: "Often used for voice recordings, such as podcasts and voice memos, where high fidelity is not crucial." },
	{ text: "96 kbps", value: 96000, description: "A balanced option for voice recordings with better quality than 64 kbps." },
	{ text: "128 kbps", value: 128000, description: "Frequently used for music streaming services and general audio recordings, offering a good balance between quality and file size.", default: true },
	{ text: "192 kbps", value: 192000, description: "Higher quality audio, often used for high-fidelity music streaming and better quality audio recordings." },
	{ text: "256 kbps", value: 256000, description: "Commonly used for high-quality music files; provides near CD-quality audio." },
	{ text: "320 kbps", value: 320000, description: "Often considered the highest quality for MP3 files, providing near lossless quality audio." },
];
const videoBitRates = [
	{
		text: "500 kbps - Low resolution (240p/360p)",
		value: 500000,
		description:
			"Suitable for low-resolution video (e.g., 240p or 360p) where file size and bandwidth are critical constraints. Commonly used for video conferencing on poor connections or for mobile video streaming at low quality.",
	},
	{
		text: "1 Mbps - Standard definition (480p)",
		value: 1000000,
		description:
			"Good for standard-definition video (e.g., 480p). Often used for basic video streaming where higher quality is not essential. Suitable for low-bandwidth environments.",
	},
	{
		text: "2.5 Mbps - High definition (720p)",
		value: 2500000,
		description:
			"Typically used for high-definition (HD) video at 720p. Provides a good balance between video quality and file size. Commonly used for HD video streaming services.",
		default: true,
	},
	{
		text: "5 Mbps - Full HD (1080p)",
		value: 5000000,
		description:
			"Suitable for full HD (1080p) video recording and streaming. Provides high-quality video suitable for YouTube uploads, live streaming, and video conferencing with high definition.",
	},
	{
		text: "8 Mbps - High-quality HD/4K",
		value: 8000000,
		description:
			"High-quality full HD (1080p) or 4K video recording. Provides excellent video quality with relatively large file sizes. Used for professional video production and situations where video quality is paramount.",
	},
];
const mimeTypesWithCodecs = [
	{value: "video/webm;codecs=vp8", text: "video/webm;codecs=vp8"},
	{value: "video/webm;codecs=vp9", text: "video/webm;codecs=vp9"},
];

const supportedMimeTypesWithCodecs = mimeTypesWithCodecs.filter((type) =>
	MediaRecorder.isTypeSupported(type.value)
);

const $ = (elId) => document.getElementById(elId);
const videoFormatSelect = $("video-format");
const audioBitsSelect = $("audio-bits");
const videoBitsSelect = $("video-bits");
const frameRateSelect = $("frame-rate");
const audioInputSelect = $("audio-input");
const videoSourceButton = $("video-source");
const recordButton = $("record-button-handler");
const form = $("recorder-settings-form");
const videoPreview = $("video-preview");

(async () => {
	if (!navigator.mediaDevices) {
		alert("Error: your browser does not support recording.")
	}
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.register("./sw.js");
	}
	
	await hydrate();

	handleVideoSourceSelection();

	handleFormSubmitting();

})()

async function hydrate() {
	supportedMimeTypesWithCodecs.forEach((rate) => {
		const option = document.createElement("option");
		option.value = rate.value;
		option.text = rate.text;
		option.defaultSelected = rate.default;
		videoFormatSelect.appendChild(option);
	});
	audioBitsRates.forEach((rate) => {
		const option = document.createElement("option");
		option.value = rate.value;
		option.text = rate.text;
		option.defaultSelected = rate.default;
		audioBitsSelect.appendChild(option);
	});
	videoBitRates.forEach((rate) => {
		const option = document.createElement("option");
		option.value = rate.value;
		option.text = rate.text;
		option.defaultSelected = rate.default;
		videoBitsSelect.appendChild(option);
	});

	const devices = (await navigator.mediaDevices?.enumerateDevices()) || [];

	let filteredDevices = devices
		.filter((device) => device.kind === "audioinput")
		.filter((device) => device.deviceId);

	if (!filteredDevices.length) {
		// request mic permissions
		try {
			audioStream = await navigator.mediaDevices?.getUserMedia({
				video: false,
				audio: true,
			});
			const devices = await navigator.mediaDevices?.enumerateDevices();

			filteredDevices = devices
				.filter((device) => device.kind === "audioinput")
				.filter((device) => device.deviceId);
		} catch (error) {
			console.log("User does not allow mic permissions");
		}
	}
	filteredDevices.forEach((device) => {
		const option = document.createElement("option");
		option.value = device.deviceId;
		option.text = device.label;
		audioInputSelect.appendChild(option);
	});
}

function handleVideoSourceSelection() {
	videoSourceButton.addEventListener("click", async (e) => {
		e.preventDefault();

		videoStream = await navigator.mediaDevices?.getDisplayMedia({
			audio: true,
			video: {
				frameRate: { ideal: frameRateSelect.value },
			},
		});
		if (!videoStream) return;
		videoPreview.srcObject = videoStream;
		recordButton.removeAttribute("disabled");
	});
}

function disableForm() {
	videoFormatSelect.setAttribute("disabled", true);
	audioBitsSelect.setAttribute("disabled", true);
	videoBitsSelect.setAttribute("disabled", true);
	frameRateSelect.setAttribute("disabled", true);
	audioInputSelect.setAttribute("disabled", true);
	videoSourceButton.setAttribute("disabled", true);
}

function enableForm() {
	videoFormatSelect.removeAttribute("disabled");
	audioBitsSelect.removeAttribute("disabled");
	videoBitsSelect.removeAttribute("disabled");
	frameRateSelect.removeAttribute("disabled");
	audioInputSelect.removeAttribute("disabled");
	videoSourceButton.removeAttribute("disabled");
	recordButton.setAttribute("disabled", true);
}

function handleFormSubmitting() {
	form.addEventListener("submit", (e) => {
		e.preventDefault();
		const formData = new FormData(e.target);
		const formProps = Object.fromEntries(formData);
		if (isRecording) {
			stopRecording();
		} else {
			startRecording(formProps);
		}
	});
}

async function startRecording(formProps) {
	const audioBits = formProps["audio-bits"];
	const videoBits = formProps["video-bits"];
	const videoFormat = formProps["video-format"];
	const audioInput = formProps["audio-input"];
	
	videoExtension = videoFormat.split(";")[0].split("/")[1] || "webm";

	try {
		disableForm();
		if (audioInput !== "none") {
			audioStream = await navigator.mediaDevices?.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					deviceId: audioInput,
				},
			});

			const audioTrack = audioStream.getAudioTracks()[0];

			videoStream.addTrack(audioTrack);
		}
		
		videoRecorder = new MediaRecorder(videoStream, {
			mimeType: videoFormat,
			audioBitsPerSecond: audioBits,
			videoBitsPerSecond: videoBits,
		});
		
		videoRecorder.start();
		
		isRecording = true;
		videoPreview.classList.add("recording")
		recordButton.textContent = "Stop recording";
		recordButton.style.backgroundColor = "var(--color-green)";
		recordButton.style.color = "#333b3c";

		const [videoTrack] = videoStream.getVideoTracks();

		videoTrack.addEventListener("ended", () => {
			stopRecording();
		});
	} catch (error) {
		console.log('error', error)
		enableForm();
		isRecording = false;
	}
}

function stopRecording() {
	enableForm();
	isRecording = false;

	videoPreview.classList.remove("recording");
	recordButton.textContent = "Start recording";
	recordButton.style.backgroundColor = "var(--bg-button)";
	recordButton.style.color = "var(--color)";
	
	videoRecorder.stop();
	handleResultData()
	
	videoStream.getTracks().forEach(track => track.stop());
	audioStream?.getTracks().forEach(track => track.stop());
}

function handleResultData() {
	videoRecorder.addEventListener("dataavailable", (e) => {
		const downloadLink = document.createElement("a");
		downloadLink.href = URL.createObjectURL(e.data);
		const date = new Date();
		const newDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
		const fileName = `${newDate.toISOString()}.${videoExtension}`;

		downloadLink.download = fileName;
		downloadLink.click();
	});
}