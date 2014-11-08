// Modules
var gulp = require('gulp');
var awspublish = require('gulp-awspublish');
var dotenv = require('dotenv');
var child_process = require('child_process');

// Globals
dotenv.load();
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


gulp.task('publish', function() {
  var publisher = awspublish.create({ key: process.env.AWS_ACCESS_KEY_ID,  secret: process.env.AWS_SECRET_ACCESS_KEY, bucket: 'traffichackers' });
  var headers = { 'Cache-Control': 'max-age=315360000, no-transform, public' };
  return gulp.src('./build/**/*.*')
  .pipe(awspublish.gzip({ ext: '' }))
  .pipe(publisher.publish(headers))
  .pipe(publisher.cache())
  .pipe(awspublish.reporter());

});

gulp.task('dev', ['watch', 'serve'])
gulp.task('prod', ['build', 'publish']);
