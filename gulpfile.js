// Modules
var gulp = require('gulp');
var awspublish = require('gulp-awspublish');
var dotenv = require('dotenv');
var child_process = require('child_process');

// Globals
dotenv.load();
var filelist = ['./src/*.html', './src/js/*', './src/css/*', './src/fonts/*', './src/roads/*', './src/thanksgiving/*'];

function buildAll(destination, includeData, callback) {
  // Build Site
  for (var i=0; i<filelist.length; i++) {
    gulp.src(filelist[i], {base:"./src/"}).pipe(gulp.dest(destination+'/'));
  }

  // Build Blog
  child_process.execFile('jekyll', ['build', '--source', './blog/', '--destination', './'+destination+'/blog/'], function(error, stdout, stderr) {
     if (error) {
       console.log(error);
     } else if (stderr) {
       console.log(stderr);
     } else {
       callback();
     }
  });

  // Include the Data Directory, if Needed
  if (includeData) {
    gulp.src('./src/data/**/*.*', {base:"./src/"}).pipe(gulp.dest(destination+'/'));
  }
}

gulp.task('build-dev', function(callback) {
  buildAll('dev', true, callback);
})

gulp.task('watch', function(callback) {
  for (var i=0; i<filelist.length; i++) {
    gulp.watch(filelist[i], ['build-dev']);
  }
  gulp.watch('./blog/**/*.*', ['build-dev']);
  gulp.watch('./src/data/*.json', ['build-dev'])
  gulp.watch('./src/data/predictions/*.json', ['build-dev'])
  callback();
});

gulp.task('serve-dev', function(callback) {
  child_process.execFile('http-server', ['dev'], function(error, stdout, stderr) {
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


gulp.task('prod', function() {
  buildAll('build', false, function() {
    var publisher = awspublish.create({ key: process.env.AWS_ACCESS_KEY_ID,  secret: process.env.AWS_SECRET_ACCESS_KEY, bucket: 'www.traffichackers.com' });
    var headers = { 'Cache-Control': 'max-age=315360000, no-transform, public' };
    return gulp.src('./build/**/*.*')
    .pipe(awspublish.gzip({ ext: '' }))
    .pipe(publisher.publish(headers))
    .pipe(publisher.cache())
    .pipe(awspublish.reporter());
  });
});

gulp.task('dev', ['build-dev', 'watch', 'serve-dev'])
