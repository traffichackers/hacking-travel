var gulp = require('gulp');
var s3 = require('s3');
var dotenv = require('dotenv');
var child_process = require('child_process');

var filelist = ['./src/*.html', './src/js/*', './src/css/*', './src/fonts/*', './src/roads/*'];
gulp.task('build', function(callback) {

  // Build Site
  for (var i=0; i<filelist.length; i++) {
    gulp.src(filelist[i], {base:"./src/"}).pipe(gulp.dest('build/'));
  }
  console.log("website built");

  // Build Blog
  child_process.execFile('jekyll', ['build', '--source', './blog/', '--destination', './build/blog/'], function(error, stdout, stderr) {
	   if (error) {
       console.log(error);
     } else if (stderr) {
       console.log(stderr);
     } else {
       console.log("blog built");
       callback();
     }
  });



});

gulp.task('watch', function(callback) {
  for (var i=0; i<filelist.length; i++) {
    gulp.watch(filelist[i], ['build']);
  }
  gulp.watch('./blog/**/*.*', ['build']);
  console.log('watching');
  callback();
});

gulp.task('serve', function(callback) {
  child_process.execFile('http-server', ['build'], function(error, stdout, stderr) {
    if (error) {
      console.log(error);
    } else if (stderr) {
      console.log(stderr);
    } else {
      console.log(stdout);
    }
  });
  console.log("website running at http://localhost:8080");
  callback();
})

gulp.task('upload-aws', function(callback) {
  dotenv.load();
  var client = s3.createClient({
    s3Options: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
  });
  var params = {
    localDir: "build",
    deleteRemoved: false,
    s3Params: {
      Bucket: "traffichackers",
    }
  };
  var uploader = client.uploadDir(params);
  uploader.on('error', function(err) {
    console.error("unable to sync:", err.stack);
  });
  uploader.on('progress', function() {
    console.log("progress", uploader.progressAmount, uploader.progressTotal);
  });
  uploader.on('end', function() {
    console.log("done uploading");
    callback();
  });
});

gulp.task('dev', ['watch', 'serve'])
gulp.task('prod', ['build', 'upload-aws']);
