function motion_gestures() {

    var lastImageDataVer = null;
    var lastImageDataHor = null;
    var prevVerFrame = null;
    var prevHorFrame = null;
    var samplingFactor = 10;
    var noiseThreshold = 1000;

    var vertical_callback = raise_callback();
    var horizontal_callback = raise_callback();

    var video, canvasSource, canvasBlendedVer, canvasBlendedHor;
    var contextBlendedVer, contextBlendedHor, contextSource;
    var left_callback, right_callback, up_callback, down_callback;

    function init() {
        $('body').append(
            '<video id="webcam" autoplay width="640" height="480" style="display:none;"></video>' +
            '<canvas id="canvas-source" width="640" height="480" style="display:none;"></canvas>' +
            '<div id="motion-gestures-ver">' +
                '<canvas id="canvas-blended-ver" width="200" height="280"></canvas>' +
                '<button id="hide-motion-gestures-ver">Hide</button>' +
            '</div>' +
            '<div id="motion-gestures-hor">' +
                '<canvas id="canvas-blended-hor" width="440" height="200"></canvas>' +
                '<button id="hide-motion-gestures-hor">Hide</button>' +
            '</div>'
        );
        $('#hide-motion-gestures-ver').click(function(){
            $('#motion-gestures-ver').hide();
        });

        $('#hide-motion-gestures-hor').click(function(){
            $('#motion-gestures-hor').hide();
        });

        video = $('#webcam')[0];
        canvasSource = $("#canvas-source")[0];
        canvasBlendedVer = $("#canvas-blended-ver")[0];
        canvasBlendedHor = $("#canvas-blended-hor")[0];

        navigator.webkitGetUserMedia({audio: false, video: true}, function(stream) {
            video.src = window.webkitURL.createObjectURL(stream);
            video.muted = 'muted';
        }, webcam_error);

        contextBlendedVer = canvasBlendedVer.getContext('2d');
        contextBlendedHor = canvasBlendedHor.getContext('2d');
        contextSource = canvasSource.getContext('2d');
        contextSource.translate(canvasSource.width, 0);
        contextSource.scale(-1, 1);

        start();
    }

    function start() {

        function drawVideo() {
            contextSource.drawImage(video, 0, 0, video.width, video.height);
        }

        function verticalBlend() {
            var width = canvasSource.width;
            var height = canvasSource.height;
            var dataWidth = 200;
            var dataHeight = height - 200;
            var sourceData = contextSource.getImageData(width - dataWidth, 0, dataWidth, dataHeight);
            if (!lastImageDataVer) lastImageDataVer = contextSource.getImageData(width - dataWidth, 0, dataWidth, dataHeight);
            var blendedData = contextSource.createImageData(dataWidth, dataHeight);
            var lines = new Array(dataHeight);
            differenceAccuracy(blendedData.data, sourceData.data, lastImageDataVer.data, lines, dataWidth);
            contextBlendedVer.putImageData(blendedData, 0, 0);
            lastImageDataVer = sourceData;
        }

        function horizontalBlend() {
            var width = canvasSource.width;
            var height = canvasSource.height;
            var sourceData = contextSource.getImageData(0, height - 200, width - 200, 200);
            if (!lastImageDataHor) {
              console.log('setting last image data');
              lastImageDataHor = contextSource.getImageData(0, height - 200, width - 200, 200);
            }
            var blendedData = contextSource.createImageData(width - 200, 200);
            differenceAccuracy(blendedData.data, sourceData.data, lastImageDataHor.data);
            contextBlendedHor.putImageData(blendedData, 0, 0);
            lastImageDataHor = sourceData;
        }

        function fastAbs(value) {
            return (value ^ (value >> 31)) - (value >> 31);
        }

        function threshold(value) {
            return (value > 73) ? 0xFF : 0;
        }

      function setDataPoint(width, line, pos, target) {
        var dataIndex = 4 * (width * line + pos);
        target[dataIndex] = 255;
        target[dataIndex + 1] = 0;
        target[dataIndex + 2] = 0;
        target[dataIndex + 3] = 255;
        return dataIndex;
      }

      function differenceAccuracy(target, data1, data2, lines, width) {
            if (data1.length != data2.length) return null;
            var i = 0;
            var lineWeight = 0;
            var linePosition = 0;
            var recentWeights = [0,0,0,0,0,0,0,0,0]
            var needPoint = true;
            while (i < (data1.length * 0.25)) {
                var index = 4 * i++;
                var average1 = (data1[index] + data1[index+1] + data1[index+2]);
                var average2 = (data2[index] + data2[index+1] + data2[index+2]);
                var raw_diff = fastAbs(average1 - average2);
                var diff = threshold(raw_diff);
                target[index] = diff;
                target[index+1] = diff;
                target[index+2] = diff;
                target[index+3] = 255;
                if (lines !== undefined) {
                  if (diff === 0xFF) {
                    linePosition += (i % width);
                    lineWeight += 1;
                  }
                  if ((i % width) === (width - 1)) {
                    var line = Math.floor(i/width) 
                    recentWeights.push(lineWeight);
                    recentWeights.shift();
                    var rollingWeight = 0;
                    recentWeights.forEach(function(weight) {
                      rollingWeight += weight;
                    });
                    if (needPoint && rollingWeight > 8) {
                      var pos = Math.floor(linePosition/lineWeight);
                      lines[line] = pos;
                      for (var x=-2; x<3; x++) {
                        for (var y=-2; y<3; y++) {
                          setDataPoint(width, line + y, pos + x, target);
                        }
                      }
                      needPoint = false;
                    }
                    else {
                      lines[line] = -1
                    }
                    lineWeight = 0
                    linePosition = 0
                  }
                }
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

        function calcVerticalWhiteArea(x, y, width, height) {
            var blendedImage = contextBlendedVer.getImageData(x, y, width, height);
            return computeWhiteArea(blendedImage.data);
        }

        function calcHorizontalWhiteArea(x, y, width, height) {
            var blendedImage = contextBlendedHor.getImageData(x, y, width, height);
            return computeWhiteArea(blendedImage.data);
        }

        function checkVerticalAreas() {
            var width = canvasBlendedVer.width;
            var height = canvasBlendedVer.height;

            var currTopWhiteArea = calcVerticalWhiteArea(0, 0, width, height / 2);
            var currBottomWhiteArea = calcVerticalWhiteArea(0, height / 2, width, height / 2);
            var currFrame = new MotionFrame(currTopWhiteArea, currBottomWhiteArea, 0, 0);

            if (prevVerFrame == null) {
                prevVerFrame = currFrame;
            } else {
                var diffs = currFrame.difference(prevVerFrame);

                if (fastAbs(diffs.top) > noiseThreshold && fastAbs(diffs.bottom) > noiseThreshold) {
                    if (diffs.top > 0 && diffs.bottom < 0) {
                        if(up_callback) vertical_callback.execute(up_callback);
                    } else if (diffs.top < 0 && diffs.bottom > 0) {
                        if(down_callback) vertical_callback.execute(down_callback);
                    }
                }
            }
            prevVerFrame = currFrame;
        }

        function checkHorizontalAreas() {
            var width = canvasBlendedHor.width;
            var height = canvasBlendedHor.height;

            var currLeftWhiteArea = calcHorizontalWhiteArea(0, 0, width / 2, height);
            var currRightWhiteArea = calcHorizontalWhiteArea(width / 2, 0, width / 2, height);
            var currFrame = new MotionFrame(0, 0, currLeftWhiteArea, currRightWhiteArea);

            if (prevHorFrame == null) {
                prevHorFrame = currFrame;
            } else {
                var diffs = currFrame.difference(prevHorFrame);

                if (fastAbs(diffs.left) > noiseThreshold && fastAbs(diffs.right) > noiseThreshold) {
                    if (diffs.left > 0 && diffs.right < 0) {
                        if(left_callback) horizontal_callback.execute(left_callback);
                    } else if (diffs.left < 0 && diffs.right > 0) {
                        if(right_callback) horizontal_callback.execute(right_callback);
                    }
                }
            }
            prevHorFrame = currFrame;
        }

        function update() {
            drawVideo();
            verticalBlend();
            horizontalBlend();
            checkVerticalAreas();
            checkHorizontalAreas();
            setTimeout(update, 1000/samplingFactor);
        }

        update();
    }

    function left(callback) {
        left_callback = callback;
    }

    function right(callback) {
        right_callback = callback;
    }

    function up(callback) {
        up_callback = callback;
    }

    function down(callback) {
        down_callback = callback;
    }

    function webcam_error(e) {
        console.log(e);
    }

    return {
        left: left,
        right: right,
        up: up,
        down: down,
        init: init
    };
}

function raise_callback() {
  var enabled = true;
  var currentTimeout;
  var previousCallback;

  function execute(callback) {
    if(enabled || (!enabled && previousCallback == callback)) {
      previousCallback = callback;
      enabled = false;
      callback();
      if(currentTimeout) clearTimeout(currentTimeout);
      currentTimeout = setTimeout(function() {
        enabled = true;
      }, 3000);
    }
  }

  return {
    execute: execute
  };

}
