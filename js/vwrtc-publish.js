//VideoWhisper.com WebRTC implemetation

//vars
'use strict';

var audioSelect = null;
var videoSelect = null;
var selectors = null;

//
var localVideo = null;
var remoteVideo = null;
var peerConnection = null;
var peerConnectionConfig = {'iceServers': []};
var localStream = null;
var wsConnection = null;
var videoIndex = -1;
var audioIndex = -1;
var newAPI = true;
var SDPOutput = new Object();


//Input Select code
function selectorsReady()
{
	//selectors
	audioSelect = document.getElementById('audioSource'); 
	videoSelect = document.getElementById('videoSource'); 

	selectors = [audioSelect, videoSelect];
	
	navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
	
	audioSelect.onchange = selectorStart;

	videoSelect.onchange = selectorStart;

	selectorStart();
}

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `microphone jQuery{audioSelect.length + 1}`;
      audioSelect.appendChild(option);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera jQuery{videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });

}

function gotStream(stream) {
  window.stream = stream; // make stream available to console
  localVideo.srcObject = stream;
  
   	console.log("gotStream after getUserMedia: "+stream);
    localStream = stream;   	
     	
     //close prev stream
     if (localStream != null) stopPublisher();
     
 	//publish
 	startPublisher();

  // Refresh button list in case labels have become available
  return navigator.mediaDevices.enumerateDevices();
}

function handleError(error) {
  console.log('navigator.getUserMedia select error: ', error);
}

function selectorStart() {
  if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
    });
  }
  const audioSource = audioSelect.value;
  const videoSource = videoSelect.value;
  const constraints = {
    audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
    video: {deviceId: videoSource ? {exact: videoSource} : undefined}
  };
  
 

    if(navigator.mediaDevices.getUserMedia)
	{
		navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).catch(handleError);
		newAPI = true;

	}
    else if (navigator.getUserMedia)
    {
        navigator.getUserMedia(constraints, gotStream, errorHandler).then(gotDevices).catch(handleError);
        newAPI = false;

    }
    else
    {
        alert('Your browser does not support getUserMedia API');
    }

	console.log("newAPI: "+newAPI);

 
}



//WebRTC Publish



function browserReady()
{

	localVideo = document.getElementById('localVideo');
	if ( userAgent == null )
	{
		userAgent="unknown";
	}

	selectorsReady();
	
}

function wsConnect(url)
{
	wsConnection = new WebSocket(url);
	wsConnection.binaryType = 'arraybuffer';

	wsConnection.onopen = function()
	{
		console.log("wsConnection.onopen");

		peerConnection = new RTCPeerConnection(peerConnectionConfig);
		peerConnection.onicecandidate = gotIceCandidate;

		if (newAPI)
		{
			
			localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));	
		//	localStream.getTracks().forEach(function(track) {peerConnection.addTrack(track, stream);});
		/*	
			var localTracks = localStream.getTracks();
			for(var localTrack in localTracks)
			{
				peerConnection.addTrack(localTracks[localTrack], localStream);
			}
			*/
		}
		else
		{
			peerConnection.addStream(localStream);
		}

		peerConnection.createOffer(gotDescription, errorHandler);


	}

	wsConnection.onmessage = function(evt)
	{
		console.log("wsConnection.onmessage: "+evt.data);

		var msgJSON = JSON.parse(evt.data);

		var msgStatus = Number(msgJSON['status']);
		var msgCommand = msgJSON['command'];

		if (msgStatus != 200)
		{
			jQuery("#sdpDataTag").html(msgJSON['statusDescription']);
			stopPublisher();
		}
		else
		{
			jQuery("#sdpDataTag").html("");

			var sdpData = msgJSON['sdp'];
			if (sdpData !== undefined)
			{
				console.log('sdp: '+msgJSON['sdp']);

				peerConnection.setRemoteDescription(new RTCSessionDescription(sdpData), function() {
					//peerConnection.createAnswer(gotDescription, errorHandler);
				}, errorHandler);
			}

			var iceCandidates = msgJSON['iceCandidates'];
			if (iceCandidates !== undefined)
			{
				for(var index in iceCandidates)
				{
					console.log('iceCandidates: '+iceCandidates[index]);

					peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidates[index]));
				}
			}
		}

		if (wsConnection != null)
			wsConnection.close();
		wsConnection = null;
	}

	wsConnection.onclose = function()
	{
		console.log("wsConnection.onclose");
	}

	wsConnection.onerror = function(evt)
	{
		console.log("wsConnection.onerror: "+JSON.stringify(evt));

		jQuery("#sdpDataTag").html('WebSocket connection failed: '+wsURL);
		stopPublisher();
	}
}

function getUserMediaSuccess(stream)
{
	console.log("getUserMediaSuccess: "+stream);
    localStream = stream;
 	localVideo.srcObject = stream; 
 	
 	//publish
 	startPublisher();
}

function startPublisher()
{

	console.log("startPublisher: wsURL:"+wsURL+" streamInfo:"+JSON.stringify(streamInfo));

	wsConnect(wsURL);
}

function stopPublisher()
{
	if (peerConnection != null)
		peerConnection.close();
	peerConnection = null;

	if (wsConnection != null)
		wsConnection.close();
	wsConnection = null;

	console.log("stopPublisher");
}

function start()
{
	if (peerConnection == null)
		startPublisher();
	else
		stopPublisher();
}

function gotIceCandidate(event)
{
    if(event.candidate != null)
    {
    	console.log('gotIceCandidate: '+JSON.stringify({'ice': event.candidate}));
    }
}

function gotDescription(description)
{
	var enhanceData = new Object();

	if (audioBitrate !== undefined)
		enhanceData.audioBitrate = Number(audioBitrate);
	if (videoBitrate !== undefined)
		enhanceData.videoBitrate = Number(videoBitrate);
	if (videoFrameRate !== undefined)
		enhanceData.videoFrameRate = Number(videoFrameRate);


	description.sdp = enhanceSDP(description.sdp, enhanceData);

	console.log('gotDescription: '+JSON.stringify({'sdp': description}));

    peerConnection.setLocalDescription(description, function () {

	wsConnection.send('{"direction":"publish", "command":"sendOffer", "streamInfo":'+JSON.stringify(streamInfo)+', "sdp":'+JSON.stringify(description)+', "userData":'+JSON.stringify(userData)+'}');

    }, function() {console.log('set description error')});
}

function addAudio(sdpStr, audioLine)
{
	var sdpLines = sdpStr.split(/\r\n/);
	var sdpSection = 'header';
	var hitMID = false;
	var sdpStrRet = '';
	var done = false;

	for(var sdpIndex in sdpLines)
	{
		var sdpLine = sdpLines[sdpIndex];

		if (sdpLine.length <= 0)
			continue;


		sdpStrRet +=sdpLine;
		sdpStrRet += '\r\n';

		if ( 'a=rtcp-mux'.localeCompare(sdpLine) == 0 && done == false )
		{
			sdpStrRet +=audioLine;
			done = true;
		}


	}
	return sdpStrRet;
}

function addVideo(sdpStr, videoLine)
{
	var sdpLines = sdpStr.split(/\r\n/);
	var sdpSection = 'header';
	var hitMID = false;
	var sdpStrRet = '';
	var done = false;

	var rtcpSize = false;
	var rtcpMux = false;

	for(var sdpIndex in sdpLines)
	{
		var sdpLine = sdpLines[sdpIndex];

		if (sdpLine.length <= 0)
			continue;

		if ( sdpLine.includes("a=rtcp-rsize") )
		{
			rtcpSize = true;
		}

		if ( sdpLine.includes("a=rtcp-mux") )
		{
			rtcpMux = true;
		}

	}

	for(var sdpIndex in sdpLines)
	{
		var sdpLine = sdpLines[sdpIndex];

		sdpStrRet +=sdpLine;
		sdpStrRet += '\r\n';

		if ( ('a=rtcp-rsize'.localeCompare(sdpLine) == 0 ) && done == false && rtcpSize == true)
		{
			sdpStrRet +=videoLine;
			done = true;
		}

		if ( 'a=rtcp-mux'.localeCompare(sdpLine) == 0 && done == true && rtcpSize == false)
		{
			sdpStrRet +=videoLine;
			done = true;
		}

		if ( 'a=rtcp-mux'.localeCompare(sdpLine) == 0 && done == false && rtcpSize == false )
		{
			done = true;
		}

	}
	return sdpStrRet;
}

function enhanceSDP(sdpStr, enhanceData)
{
	var sdpLines = sdpStr.split(/\r\n/);
	var sdpSection = 'header';
	var hitMID = false;
	var sdpStrRet = '';
	var audioMLines = null;

	if ( !sdpStr.includes("THIS_IS_SDPARTA") || videoChoice.includes("VP9") )
	{
		for(var sdpIndex in sdpLines)
		{
			var sdpLine = sdpLines[sdpIndex];

			if (sdpLine.length <= 0)
				continue;

			var doneCheck = checkLine(sdpLine);
			if ( !doneCheck )
				continue;

			sdpStrRet +=sdpLine;
			sdpStrRet += '\r\n';

		}
		sdpStrRet =  addAudio(sdpStrRet, deliverCheckLine(audioChoice,"audio"));
		sdpStrRet =  addVideo(sdpStrRet, deliverCheckLine(videoChoice,"video"));
		sdpStr = sdpStrRet;
		sdpLines = sdpStr.split(/\r\n/);
		sdpStrRet = '';
	}

	for(var sdpIndex in sdpLines)
	{
		var sdpLine = sdpLines[sdpIndex];

		if (sdpLine.length <= 0)
			continue;

		if ( sdpLine.indexOf("m=audio") ==0 && audioIndex !=-1 )
		{
			audioMLines = sdpLine.split(" ");
			sdpStrRet+=audioMLines[0]+" "+audioMLines[1]+" "+audioMLines[2]+" "+audioIndex+"\r\n";
			continue;
		}

		if ( sdpLine.indexOf("m=video") == 0 && videoIndex !=-1 )
		{
			audioMLines = sdpLine.split(" ");
			sdpStrRet+=audioMLines[0]+" "+audioMLines[1]+" "+audioMLines[2]+" "+videoIndex+"\r\n";
			continue;
		}

		sdpStrRet += sdpLine;

		if (sdpLine.indexOf("m=audio") === 0)
		{
			sdpSection = 'audio';
			hitMID = false;
		}
		else if (sdpLine.indexOf("m=video") === 0)
		{
			sdpSection = 'video';
			hitMID = false;
		}
		else if (sdpLine.indexOf("a=rtpmap") == 0 )
		{
			sdpSection = 'bandwidth';
			hitMID = false;
		}

		if (sdpLine.indexOf("a=mid:") === 0 || sdpLine.indexOf("a=rtpmap") == 0 )
		{
			if (!hitMID)
			{
				if ('audio'.localeCompare(sdpSection) == 0)
				{
					if (enhanceData.audioBitrate !== undefined)
					{
						sdpStrRet += '\r\nb=CT:' + (enhanceData.audioBitrate);
						sdpStrRet += '\r\nb=AS:' + (enhanceData.audioBitrate);
					}
					hitMID = true;
				}
				else if ('video'.localeCompare(sdpSection) == 0)
				{
					if (enhanceData.videoBitrate !== undefined)
					{
						sdpStrRet += '\r\nb=CT:' + (enhanceData.videoBitrate);
						sdpStrRet += '\r\nb=AS:' + (enhanceData.videoBitrate);
						if ( enhanceData.videoFrameRate !== undefined )
							{
								sdpStrRet += '\r\na=framerate:'+enhanceData.videoFrameRate;
							}
					}
					hitMID = true;
				}
				else if ('bandwidth'.localeCompare(sdpSection) == 0 )
				{
					var rtpmapID;
					rtpmapID = getrtpMapID(sdpLine);
					if ( rtpmapID !== null  )
					{
						var match = rtpmapID[2].toLowerCase();
						if ( ('vp9'.localeCompare(match) == 0 ) ||  ('vp8'.localeCompare(match) == 0 ) || ('h264'.localeCompare(match) == 0 ) ||
							('red'.localeCompare(match) == 0 ) || ('ulpfec'.localeCompare(match) == 0 ) || ('rtx'.localeCompare(match) == 0 ) )
						{
							if (enhanceData.videoBitrate !== undefined)
								{
								sdpStrRet+='\r\na=fmtp:'+rtpmapID[1]+' x-google-min-bitrate='+(enhanceData.videoBitrate)+';x-google-max-bitrate='+(enhanceData.videoBitrate);
								}
						}

						if ( ('opus'.localeCompare(match) == 0 ) ||  ('isac'.localeCompare(match) == 0 ) || ('g722'.localeCompare(match) == 0 ) || ('pcmu'.localeCompare(match) == 0 ) ||
								('pcma'.localeCompare(match) == 0 ) || ('cn'.localeCompare(match) == 0 ))
						{
							if (enhanceData.audioBitrate !== undefined)
								{
								sdpStrRet+='\r\na=fmtp:'+rtpmapID[1]+' x-google-min-bitrate='+(enhanceData.audioBitrate)+';x-google-max-bitrate='+(enhanceData.audioBitrate);
								}
						}
					}
				}
			}
		}
		sdpStrRet += '\r\n';
	}
	console.log("Resuling SDP: "+sdpStrRet);
	return sdpStrRet;
}

function deliverCheckLine(profile,type)
{
	var outputString = "";
	for(var line in SDPOutput)
	{
		var lineInUse = SDPOutput[line];
		outputString+=line;
		if ( lineInUse.includes(profile) )
		{
			if ( profile.includes("VP9") || profile.includes("VP8"))
			{
				var output = "";
				var outputs = lineInUse.split(/\r\n/);
				for(var position in outputs)
				{
					var transport = outputs[position];
					if (transport.indexOf("transport-cc") !== -1 || transport.indexOf("goog-remb") !== -1 || transport.indexOf("nack") !== -1)
					{
						continue;
					}
					output+=transport;
					output+="\r\n";
				}

				if (type.includes("audio") )
				{
					audioIndex = line;
				}

				if (type.includes("video") )
				{
					videoIndex = line;
				}

				return output;
			}
			if (type.includes("audio") )
			{
				audioIndex = line;
			}

			if (type.includes("video") )
			{
				videoIndex = line;
			}
			return lineInUse;
		}
	}
	return outputString;
}

function checkLine(line)
{
	if ( line.startsWith("a=rtpmap") || line.startsWith("a=rtcp-fb") || line.startsWith("a=fmtp"))
	{
		var res = line.split(":");

		if ( res.length>1 )
		{
			var number = res[1].split(" ");
			if ( !isNaN(number[0]) )
			{
				if ( !number[1].startsWith("http") && !number[1].startsWith("ur") )
				{
					var currentString = SDPOutput[number[0]];
					if (!currentString)
					{
						currentString = "";
					}
					currentString+=line+"\r\n";
					SDPOutput[number[0]]=currentString;
					return false;
				}
			}
		}
	}

	return true;
}

function getrtpMapID(line)
{
	var findid = new RegExp('a=rtpmap:(\\d+) (\\w+)/(\\d+)');
	var found = line.match(findid);
	return (found && found.length >= 3) ? found: null;
}

function errorHandler(error)
{
    console.log(error);
}

//end


