'use strict';

/**
 * @ngdoc function
 * @name frontApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the frontApp
 */
angular.module('frontApp')
  .controller('MainCtrl', function () {
    if (!hasGetUserMedia()) {
        alert('Browser not supported to take pictures');
        return;
    }

    $('#snap').on('click', takePhoto);
    $('.delete-button').on('click', deletePhoto);

    updateButtonState();
    startRecord();
  });


var resolutions = [
    {width: 1280, height: 720}
    , {width: 1920, height: 1080}
];
var photoWidth = resolutions[0].width, photoHeight = resolutions[0].height;
var uploadingPhotos = 0;
var finishedPhotos = 0;
var succeedPhotos = 0;
var imgBaseUrl = 'api.kairos.com';

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

function doneObservations() {
    $('#observations-progress').hide();
    $('#observations-error').hide();
    $('#observations-button').show();
}

function editObservations() {
    $('#observations').hide();
    $('#observations-error').hide();
    $('#observations-button').hide();
    $('#observations-edit').show().focus();
}

function saveObservations() {
    var txt = $('#observations-edit').hide().val();
    $('#observations').text(txt).show();
    $('#observations-progress').show();
    $('#observations-error').hide();

    $.ajax('BASDAS', {
        type: "post",
        dataType: 'json',
        data: {
            'text': txt
        }
    })
    .done(function(resp){
        doneObservations();
    })
    .fail(function () {
        $('#observations-progress').hide();
        $('#observations-error').show();
        setTimeout(saveObservations, 2000);
    })
}

function keyPressObservations(ev) {
    if (ev.keyCode == 13) {
        $('#observations-edit').blur();
        ev.preventDefault();
    }
}

function record(resolution) {
    var $video = $('#video');
    var video = $video[0];

    var videoContrains = {
        video: {
            width: { min: resolution.width },
            height: { min: resolution.height },
            mandatory: {
                minWidth: resolution.width,
                minHeight: resolution.height
            },
            optional: []
        },
        audio: false
    };

    navigator.mediaDevices.getUserMedia(videoContrains)
        .then(function(stream) {
            video.src = window.URL.createObjectURL(stream);
            video.play();
            setTimeout(function(){
                $('#snap').enable(true);
            }, 1000);

            photoWidth = resolution.width;
            photoHeight = resolution.height;
        })
        .catch(function (err) {
            console.error(err);
            startRecord();
        });
}

function backAvailable() {
    var allPhotosFinished = uploadingPhotos === finishedPhotos;

    return allPhotosFinished;
}

function finishAvailable() {
    var allPhotosFinished = uploadingPhotos === finishedPhotos;
    return allPhotosFinished && succeedPhotos >= 1;
}

function updateButtonState() {
    $('#back').enable(backAvailable());
    $('#succeed-counter').html(succeedPhotos);
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

function takePhoto() {
    $('#snap').enable(false);

    var video = $('#video').get(0);
    var $thumbnails = $('#thumbnails');
    var photo = createImages($thumbnails, video);

    uploadImage(photo);
}

function uploadImage(photo) {
    $('#snap').enable(false);

    uploadingPhotos++;
    updateButtonState();

    var img = photo.fullImage.get(0).toDataURL('image/jpeg', 0.8);

    var contentType = 'image/jpeg';
    var encoding = 'base64';
    var fullImage = img.slice(23);

    $('#snap-take-photo').hide();
    $('#snap-loading').show();

    photo.loading.show();
    photo.fail.hide();

    $.ajax('ASD', {
        type: "post",
        dataType: 'json',
        data: {
            'contentType': contentType,
            'encoding': encoding,
            'image': fullImage
        }
    })
    .done(function(resp){
        succeedPhotos++;
        photo.id = resp.id;
        showRealImage(photo, resp.filename);
        updateButtonState();
    })
    .fail(function () {
        photo.fail.show();
    })
    .always(function(){
        if (photo.loading) {
            photo.loading.hide();
        }

        finishedPhotos++;
        updateButtonState();
        $('#snap').enable(true);
        $('#snap-take-photo').show();
        $('#snap-loading').hide();
    });
}

function createImages($container, video) {
    var tw = 266, th = 150;
    var uniq = (new Date()).getTime();

    $container.prepend(
    '<div id="group-'+uniq+'" class="photo-group" style="display: inline-block; margin: 0 5px; position: relative;">' +
        '<div id="loading-'+uniq+'" style="display: block; position: absolute; z-index: 10; width: '+tw+'px; height: '+th+'px; background: rgba(0,0,0,0.5); text-align: center;">' +
            '<span style="line-height: '+th+'px; color: #FFF; margin: 0 auto;">UPLOADING</span>' +
        '</div>' +
        '<div id="failed-'+uniq+'" style="cursor: pointer; display: none; position: absolute; z-index: 10; width: '+tw+'px; height: '+th+'px; background: rgba(255,0,0,0.4); text-align: center;">' +
            '<span style="line-height: '+th+'px; color: #FFF; margin: 0 auto;">FAILED</span>' +
        '</div>' +
        '<div id="delete-'+ uniq +'" class="delete-button" style="display: none; z-index: 30; cursor: pointer; position: absolute; width: 25px; height: 25px; background: rgba(0,0,0,.8); font-size: 20px; line-height: 25px; text-align: center; color: white; right: 0;">' +
            '&times;' +
        '</div>' +
        '<img data-toggle="modal" data-target="#large-photo-modal" id="img-'+uniq+'" width="'+tw+'" height="'+th+'" style="display: none; z-index: 20; cursor: zoom-in;"/>' +
        '<canvas id="thumbnail-'+uniq+'" width="'+tw+'" height="'+th+'"></canvas>' +
        '<canvas id="full-'+uniq+'" width="'+ photoWidth +'" height="'+ photoHeight +'" style="display: none; opacity: 0;"></canvas>' +
    '</div>');

    var $group = $container.find('#group-' + uniq);
    var $thumbnail = $group.find('#thumbnail-' + uniq);
    var $fullImage = $group.find('#full-' + uniq);
    var $fail = $group.find('#failed-' + uniq);
    var $loading = $group.find('#loading-' + uniq);
    var $img = $group.find('#img-' + uniq);
    var $delete = $group.find('#delete-' + uniq);

    var thumbContext = $thumbnail.get(0).getContext('2d');
    var fullImageContext = $fullImage.get(0).getContext('2d');
    thumbContext.drawImage(video, 0, 0, tw, th);
    fullImageContext.drawImage(video, 0, 0);

    $delete.on('click', deletePhoto);

    var photo = {
        'id': uniq,
        'group': $group,
        'thumbnail': $thumbnail,
        'fullImage': $fullImage,
        'fail': $fail,
        'loading': $loading,
        'img': $img,
        'delete': $delete
    };

    photo.fail.on('click', function(){
        uploadImage(photo);
    })

    return photo;
}

function deletePhoto() {
    var $elem = $(this);
    var photoId = $elem.data('photo-id');

    if ($elem.data('loading')) {
        return;
    }
    $elem.data('loading', true);

    $elem.html('<i class="fa fa-spin fa-spinner"></i>');
    uploadingPhotos++;
    updateButtonState();

    var route = '124';
    console.log(route.replace('--ID--', photoId));
    $.ajax(route.replace('--ID--', photoId), {
        type: "delete",
        dataType: 'json'
    })
    .done(function(){
        succeedPhotos--;
        $elem.parents('.photo-group').remove();
        updateButtonState();
    })
    .fail(function () {
        $elem.html('&times;');
    })
    .always(function(){
        finishedPhotos++;
        updateButtonState();
        $elem.data('loading', false);
    });
}


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