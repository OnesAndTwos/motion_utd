function MotionSystem(_video, _canvasSource, _canvasBlended) {
  var video = _video;
  var canvasSource = _canvasSource;
  var canvasBlended = _canvasBlended;
  var contextSource = canvasSource.getContext('2d');
  var contextBlended = canvasBlended.getContext('2d');
  var lastImageData = null;
  var prevTopWhiteArea, prevBottomWhiteArea, prevLeftWhiteArea, prevRightWhiteArea;
  contextSource.translate(canvasSource.width, 0);
  contextSource.scale(-1, 1);

  this.start = function () {
    function drawVideo() {
      contextSource.drawImage(video, 0, 0, video.width, video.height);
    }

    function blend() {
      var width = canvasSource.width;
      var height = canvasSource.height;
      var sourceData = contextSource.getImageData(width - 200, height - 200, 200, 200);
      if (!lastImageData) lastImageData = contextSource.getImageData(width - 200, height - 200, 200, 200);
      var blendedData = contextSource.createImageData(200, 200);
      differenceAccuracy(blendedData.data, sourceData.data, lastImageData.data);
      contextBlended.putImageData(blendedData, 0, 0);
      lastImageData = sourceData;

      //contextBlended.strokeStyle = "#FF0000";
      //contextBlended.strokeRect(width - 200, height - 200, 200, 200);
    }

    function fastAbs(value) {
      // equivalent to Math.abs();
      return (value ^ (value >> 31)) - (value >> 31);
    }

    function threshold(value) {
      return (value > 21) ? 0xFF : 0;
    }

    function differenceAccuracy(target, data1, data2) {
      if (data1.length != data2.length) return null;
      var i = 0;
      while (i < (data1.length * 0.25)) {
        var index = 4 * i++;
        var average1 = (data1[index] + data1[index+1] + data1[index+2]) / 3;
        var average2 = (data2[index] + data2[index+1] + data2[index+2]) / 3;
        var diff = threshold(fastAbs(average1 - average2));
        target[index] = diff;
        target[index+1] = diff;
        target[index+2] = diff;
        target[index+3] = 255;
      }
    }

    function computeWhiteArea(blendedData) {
      var whiteArea = 0, i = 0;
      var limit = blendedData.length * 0.25;
      while (i < limit) {
        var index = 4 * i++;
        whiteArea += blendedData[index] & 1;
      }
      return whiteArea;
    }

    function calcWhiteArea(x, y, width, height) {
      var topBlended = contextBlended.getImageData(x, y, width, height );
      return computeWhiteArea(topBlended.data);
    }

    function checkAreas() {
      var width = canvasBlended.width;
      var height = canvasBlended.height;

      var currLeftWhiteArea = calcWhiteArea(0, 0, width / 2, height);
      var currRightWhiteArea = calcWhiteArea(width / 2, 0, width / 2, height);
      var currTopWhiteArea = calcWhiteArea(0, 0, width, height / 2);
      var currBottomWhiteArea = calcWhiteArea(0, height / 2, width, height / 2);

      if (prevTopWhiteArea == null) {
        prevTopWhiteArea = currTopWhiteArea;
        prevBottomWhiteArea = currBottomWhiteArea;
        prevLeftWhiteArea = currLeftWhiteArea;
        prevRightWhiteArea = currRightWhiteArea;
        console.log("no history");
      } else {
        topDiff = currTopWhiteArea - prevTopWhiteArea ;
        bottomDiff = currBottomWhiteArea - prevBottomWhiteArea;
        leftDiff = currLeftWhiteArea - prevLeftWhiteArea;
        rightDiff = currRightWhiteArea - prevRightWhiteArea;

        if (topDiff > 0 && bottomDiff < 0 ) {
          console.log("scrolling up");
        } else if (topDiff < 0 && bottomDiff > 0) {
          console.log("scrolling down");
        }

        if (leftDiff > 0 && rightDiff < 0) {
          console.log("scrolling left");
        } else if (leftDiff < 0 && rightDiff > 0) {
          console.log("scrolling right");
        }
      }
      prevTopWhiteArea = currTopWhiteArea;
      prevBottomWhiteArea = currBottomWhiteArea;
      prevLeftWhiteArea = currLeftWhiteArea;
      prevRightWhiteArea = currRightWhiteArea;
    }

    function update() {
      drawVideo();
      blend();
      checkAreas();
      setTimeout(update, 1000/6);
    }

    update();
  };
}

function webcamError(e) {
  alert('Webcam error!', e);
};

function initialise() {
  var video = $('#webcam')[0];
  if (navigator.getUserMedia) {
    navigator.getUserMedia({audio: false, video: true}, function(stream) {
      video.src = stream;
      video.muted = 'muted';
    }, webcamError);
  } else if (navigator.webkitGetUserMedia) {
      navigator.webkitGetUserMedia({audio: false, video: true}, function(stream) {
        video.src = window.webkitURL.createObjectURL(stream);
        video.muted = 'muted';
    }, webcamError);
  } else {
    //video.src = 'video.webm'; // fallback.
  }

  var canvasSource = $("#canvas-source")[0];
  var canvasBlended = $("#canvas-blended")[0];
  var motionSystem = new MotionSystem(video, canvasSource, canvasBlended);
  motionSystem.start();
}
