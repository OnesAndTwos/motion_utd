function MotionSystem(_video, _canvasSource, _canvasBlended) {
    var video = _video;
    var canvasSource = _canvasSource;
    var canvasBlended = _canvasBlended;
    var contextSource = canvasSource.getContext('2d');
    var contextBlended = canvasBlended.getContext('2d');
    var lastImageData = null;
    var prevTopWhiteArea, prevBottomWhiteArea, prevLeftWhiteArea, prevRightWhiteArea;
    var samplingFactor = 6;
    var noiseThreshold = 1000;
    contextSource.translate(canvasSource.width, 0);
    contextSource.scale(-1, 1);

    var up_callback = function() { console.log("up"); };
    var down_callback = function() { console.log("down"); };
    var left_callback = function() { console.log("left"); };
    var right_callback = function() { console.log("right"); };

    this.upCallbacks = function(up)
    {
        up_callback = up;
    };

    this.downCallbacks = function(down)
    {
        down_callback = down;
    };

    this.leftCallbacks = function(left)
    {
        left_callback = left;
    };

    this.rightCallbacks = function(right)
    {
        right_callback = right;
    };

    this.start = function () {
        function drawVideo() {
            contextSource.drawImage(video, 0, 0, video.width, video.height);
        }

        function blend() {
            var width = canvasSource.width;
            var height = canvasSource.height;
            var sourceData = contextSource.getImageData(width - 200, 0, 200, 480);
            if (!lastImageData) lastImageData = contextSource.getImageData(width - 200, 0, 200, 480);
            var blendedData = contextSource.createImageData(200, 480);
            differenceAccuracy(blendedData.data, sourceData.data, lastImageData.data);
            contextBlended.putImageData(blendedData, 0, 0);
            lastImageData = sourceData;

            contextBlended.strokeStyle = "#FF0000";
            contextBlended.beginPath();
            contextBlended.moveTo(0, 200);
            contextBlended.lineTo(200, 200);
            contextBlended.stroke();
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
            var blendedImage = contextBlended.getImageData(x, y, width, height);
            return computeWhiteArea(blendedImage.data);
        }

        function checkAreas() {
            var width = canvasBlended.width;
            var height = canvasBlended.height;

            var currTopWhiteArea = calcWhiteArea(0, 0, width, height / 4);
            var currBottomWhiteArea = calcWhiteArea(0, height / 4, width, height / 4);
            var currLeftWhiteArea = calcWhiteArea(0, height / 2, width / 2, height / 2);
            var currRightWhiteArea = calcWhiteArea(width / 2, height / 2, width / 2, height / 2);

            if (prevTopWhiteArea == null) {
                prevTopWhiteArea = currTopWhiteArea;
                prevBottomWhiteArea = currBottomWhiteArea;
                prevLeftWhiteArea = currLeftWhiteArea;
                prevRightWhiteArea = currRightWhiteArea;
                console.log("no history");
            } else {
                topDiff = currTopWhiteArea - prevTopWhiteArea;
                bottomDiff = currBottomWhiteArea - prevBottomWhiteArea;
                leftDiff = currLeftWhiteArea - prevLeftWhiteArea;
                rightDiff = currRightWhiteArea - prevRightWhiteArea;

                if (fastAbs(topDiff) > noiseThreshold || fastAbs(bottomDiff) > noiseThreshold) {
                    if (topDiff > 0 && bottomDiff < 0) {
                        up_callback();
                    } else if (topDiff < 0 && bottomDiff > 0) {
                        down_callback();
                    }
                }

                if (fastAbs(leftDiff) > noiseThreshold || fastAbs(rightDiff) > noiseThreshold) {
                    if (leftDiff > 0 && rightDiff < 0) {
                        left_callback();
                    } else if (leftDiff < 0 && rightDiff > 0) {
                        right_callback();
                    }
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
            setTimeout(update, 1000/samplingFactor);
        }

        update();
    };
}