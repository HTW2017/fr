'use strict';

var PHOTO_STATUSES = {
    loading: 'loading',
    failed: 'failed',
    uploaded: 'uploaded'
};

/**
 * @ngdoc function
 * @name frontApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the frontApp
 */
angular.module('frontApp')
  .controller('MainCtrl', function ($scope, $http, Notification) {
    if (!hasGetUserMedia()) {
        alert('Browser not supported to take pictures');
        return;
    }

    $scope.photos = [];
    $scope.magicNumber = 912 / 272;
    $scope.faceSquareMargin = 50 * $scope.magicNumber;
    $scope.isFullScreen = false;
    $scope.registerName = 'Alan';

    $scope.fullScreen = function() {
        $scope.isFullScreen = true;
    };

    $(document).keyup(function(e) {
         if (e.keyCode == 27) { // escape key maps to keycode `27`
            $scope.$apply(function() {
                $scope.isFullScreen = false;
            });
        }
    });

    $scope.register = function() {
        var photo = createImages($('#video').get(0), 'register');
        photo.registerName = $scope.registerName;
        $scope.photos.push(photo);
        uploadImage(photo);
    };

    $scope.recognize = function() {
        var photo = createImages($('#video').get(0), 'recognize');
        $scope.photos.push(photo);
        uploadImage(photo);
        
        var scope = $scope.$new();
        scope.photo = photo;
        scope.beerList = ['Amber Lager','Bohemian Pilsenser','Pilsener','Küné','Weisse','Session IPA'];
        scope.beer = scope.beerList[Math.floor(Math.random() * scope.beerList.length)];

        Notification({
            scope: scope 
        });
    };

    function uploadImage(photo) {
        uploadingPhotos++;

        var uploadInfo = uploadInfoStrategies[photo.type](photo);
        console.log(uploadInfo);
        return $http({
                method: 'POST',
                url: uploadInfo.url,
                headers: uploadInfo.headers,
                data: uploadInfo.body
            })
            .then(function(resp){
                var correction;
                if (resp.data.Errors) {
                    var e = new Error('request_error');
                    e.resp = resp;
                    throw e;
                }

                succeedPhotos++;
                photo.status = PHOTO_STATUSES.uploaded;
                var img = resp.data.images[0];
                photo.externalId = img.transaction.face_id;
                photo.externalImage = img;
                photo.faceSquare = {
                    top: Math.max(img.transaction.topLeftY - $scope.faceSquareMargin, 0),
                    left: Math.max(img.transaction.topLeftX - $scope.faceSquareMargin, 0),
                    height: img.transaction.height + $scope.faceSquareMargin * 2,
                    width: img.transaction.width + $scope.faceSquareMargin * 2
                };
                photo.faceSquare.height = Math.min(photo.faceSquare.height, photoHeight - photo.faceSquare.top); 
                photo.faceSquare.width = Math.min(photo.faceSquare.width, photoWidth - photo.faceSquare.left);

                if (photo.faceSquare.height > photo.faceSquare.width) {
                    correction = (photo.faceSquare.height - photo.faceSquare.width) / 2;
                    photo.faceSquare.height -= photo.faceSquare.width;
                    photo.faceSquare.top += correction;
                }
                else {
                    correction = (photo.faceSquare.width - photo.faceSquare.height) / 2;
                    photo.faceSquare.width = photo.faceSquare.height;
                    photo.faceSquare.left += correction;
                }

                var thumbnailFinalSize = 100;
                var thumbnailResizeProportion = thumbnailFinalSize / photo.faceSquare.width;
                photo.thumbnailSize = {
                    width: thumbnailWidth * thumbnailResizeProportion * $scope.magicNumber + 'px',
                    height: thumbnailHeight * thumbnailResizeProportion * $scope.magicNumber + 'px',
                };

                photo.thumbnailImage = {
                    top: photo.faceSquare.top * thumbnailResizeProportion + 'px',
                    left: photo.faceSquare.left * thumbnailResizeProportion + 'px',
                    width: thumbnailFinalSize + 'px',
                    height: thumbnailFinalSize + 'px',
                };

                if (resp.data.images && resp.data.images.length > 0 && resp.data.images[0].transaction.status == 'failure') {
                    var e = new Error('request_error');
                    e.resp = resp;
                    throw e;
                }

                return photo;
            })
            .catch(function (e) {
                photo.status = PHOTO_STATUSES.failed;

                
                if (e.message === 'request_error') {
                    if (e.resp.data.images && e.resp.data.images.length > 0 && e.resp.data.images[0].transaction.status == 'failure') {
                        photo.errors = ['No match'];
                        throw e;
                    }
                    else {
                        photo.errors = e.resp.data.Errors.map(function (e) { return e.Message; });
                    }
                    console.log(photo.errors);
                }
                else {
                    photo.errors = [e.data.message];
                    console.error(e);
                }
            })
            .then(function(p){
                finishedPhotos++;

                return p;
            });
    }


    function createImages(video, type) {
        var uniq = (new Date()).getTime();

        var $container = $('#imageContainer');

        $container.prepend(
            '<div id="group-'+uniq+'" class="photo-group" style="display: inline-block; margin: 0 5px; position: relative;">' +
                '<canvas id="full-'+uniq+'" width="'+ photoWidth +'" height="'+ photoHeight +'" style="display: none; opacity: 0;"></canvas>' +
            '</div>');

        var $group = $container.find('#group-' + uniq);
        var $fullImage = $group.find('#full-' + uniq);

        var fullImageContext = $fullImage.get(0).getContext('2d');
        fullImageContext.drawImage(video, 0, 0, photoWidth, photoHeight);

        var img = $fullImage.get(0).toDataURL('image/jpeg', 0.8);
        var contentType = 'image/jpeg';
        var encoding = 'base64';
        var fullImage = img.slice(23);

        $group.html('');

        var photo = {
            id: uniq,
            type: type,
            status: PHOTO_STATUSES.loading,
            thumbnailImage: {
                width: thumbnailWidth + 'px',
                height: thumbnailHeight + 'px',
                top: 0 + 'px',
                left: 0 + 'px',
            },
            thumbnailSize: {
                width: thumbnailWidth + 'px',
                height: thumbnailHeight + 'px',
            },
            image: {
                contentType: contentType,
                encoding: encoding,
                fullImage: fullImage
            }
        };

        return photo;
    }

    startRecord();
  });

// -------------------- RECORDING -------------------------------
var resolutions = [
    {width: 912, height: 513}
];
var thumbnailWidth = 272;
var thumbnailHeight = 153;
var photoWidth = resolutions[0].width, photoHeight = resolutions[0].height;
var uploadingPhotos = 0;
var finishedPhotos = 0;
var succeedPhotos = 0;
var kairosGalleryId = 'patagonia';
var kairosAppId = '07844605';
var kairosApiKey = '1ec90660a80a6404accd4282099f52d9';
var imgBaseUrl = 'http://localhost:3000/vision';

function hasGetUserMedia() {
    return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
}

function startRecord() {
    var res = resolutions.pop();
    if (res) {
        record(res);
    }
    else {
        alert('Error while loading camera.')
    }
}

function record(resolution) {
    var $video = $('#video');
    var video = $video[0];

    var videoContrains = {
        video: {
            width: { min: resolution.width },
            height: { min: resolution.height },
        },
        audio: false
    };

    navigator.mediaDevices.getUserMedia(videoContrains)
        .then(function(stream) {
            video.src = window.URL.createObjectURL(stream);
            video.play();
            setTimeout(function(){
                $('#snap').prop('disabled', false);
            }, 1000);

            photoWidth = resolution.width;
            photoHeight = resolution.height;
        })
        .catch(function (err) {
            console.log(err);
            startRecord();
        });
}
// -------------------- END RECORDING -------------------------------

var uploadInfoStrategies = {
    recognize: function(photo) {
        return {
            url: imgBaseUrl + '/recognize',
            headers: {
                "app_id": kairosAppId,
                "app_key": kairosApiKey
            },
            body: {
                "gallery_name": kairosGalleryId,
                "image": photo.image.fullImage
            }
        };
    },
    register: function(photo) {
        return {
            url: imgBaseUrl + '/enroll',
            headers: {
                "app_id": kairosAppId,
                "app_key": kairosApiKey
            },
            body: {
                "subject_id": photo.registerName,
                "gallery_name": kairosGalleryId,
                "image": photo.image.fullImage
            }
        };
    },
};

// ------------------------- COMPATIBILITY THINGS -----------
var promisifiedOldGUM = function(constraints) {
    // First get ahold of getUserMedia, if present
    var getUserMedia = (navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia);

    // Some browsers just don't implement it - return a rejected promise with an error
    // to keep a consistent interface
    if(!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
    }

    // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
    return new Promise(function(resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
    });

};

// Older browsers might not implement mediaDevices at all, so we set an empty object first
if(navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
}

// Some browsers partially implement mediaDevices. We can't just assign an object
// with getUserMedia as it would overwrite existing properties.
// Here, we will just add the getUserMedia property if it's missing.
if(navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = promisifiedOldGUM;
}

$('#large-photo-modal').on('show.bs.modal', function (event) {
    var $img = $(event.relatedTarget);
    var src = $img.attr('src');
    var $modal = $(this);
    $modal.find('img').attr('src', src);
})