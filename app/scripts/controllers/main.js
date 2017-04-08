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
  .controller('MainCtrl', function ($scope, $http) {
    if (!hasGetUserMedia()) {
        alert('Browser not supported to take pictures');
        return;
    }

    $scope.photos = [];

    $scope.register = function() {
        $('#snap').prop('disabled', false);

        var photo = createImages($('#video').get(0), 'register');
        $scope.photos.push(photo);
        uploadImage(photo);
    };

    $scope.recognize = function() {
        $('#snap').prop('disabled', false);

        var photo = createImages($('#video').get(0), 'recognize');
        $scope.photos.push(photo);
        uploadImage(photo);
    };

    function uploadImage(photo) {
        $('#snap').prop('disabled', true);

        uploadingPhotos++;

        $('#snap-take-photo').hide();
        $('#snap-loading').show();

        var uploadInfo = uploadInfoStrategies[photo.type](photo.image.fullImage);

        return $http({
                method: 'POST',
                url: uploadInfo.url,
                headers: uploadInfo.headers,
                data: uploadInfo.body
            })
            .then(function(resp){
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
                //showRealImage(photo, resp.filename);
            })
            .catch(function (e) {
                photo.status = PHOTO_STATUSES.failed;

                if (e.message === 'request_error') {
                    photo.errors = e.resp.data.Errors.map(function (e) { return e.Message; });
                    console.log(photo.errors);
                }
                else {
                    photo.errors = [e.data.message];
                    console.error(e);
                }
            })
            .then(function(){
                finishedPhotos++;
                $('#snap').prop('disabled', false);
                $('#snap-take-photo').show();
                $('#snap-loading').hide();
            });
    }


    function createImages(video, type) {
        var tw = 272, th = 153;
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
                width: tw + ' px',
                height: th + ' px'
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

function backAvailable() {
    var allPhotosFinished = uploadingPhotos === finishedPhotos;

    return allPhotosFinished;
}

function finishAvailable() {
    var allPhotosFinished = uploadingPhotos === finishedPhotos;
    return allPhotosFinished && succeedPhotos >= 1;
}

function showRealImage(photo, filename) {
    photo.img.attr('src', imgBaseUrl + filename);
    photo.img.show();
    photo.img.css({'display': 'block'});

    photo.delete.data('photo-id', photo.id);
    photo.delete.show();
    photo.delete.css({'display': 'block'});


    photo.thumbnail.remove();
    photo.fullImage.remove();
    photo.fail.remove();
    photo.loading.remove();

    delete photo.thumbnail;
    delete photo.fullImage;
    delete photo.fail;
    delete photo.loading;
}

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
                "image": photo
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
                "subject_id": "Alan",
                "gallery_name": kairosGalleryId,
                "image": photo
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