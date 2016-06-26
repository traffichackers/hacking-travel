// Modules
var gulp = require('gulp');
var awspublish = require('gulp-awspublish');
var dotenv = require('dotenv');
var child_process = require('child_process');
var del = require('del');

// Globals
dotenv.load();
var filelist = ['./site/*.html', './site/js/*', './site/css/*', './site/fonts/*', './site/roads/*', './site/christmas/*'];

function buildAll(destination, includeData, callback) {

  del([destination+'/**'], function() {

    // Build Site
    for (var i=0; i<filelist.length; i++) {
      gulp.src(filelist[i], {base:"./site/"}).pipe(gulp.dest(destination+'/'));
    }

    // Include the Data Directory, if Needed
    if (includeData) {
      gulp.src('./site/data/*.*', {base:"./site/"}).pipe(gulp.dest(destination+'/'));
    }

    // Build Blog
    buildBlog(destination, callback);

  });
}

function buildBlog(destination, callback) {
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
}

function uploadToAws(directory, bucketName) {
  console.log(process.env.AWS_ACCESS_KEY_ID)
  var publisher = awspublish.create({ key: process.env.AWS_ACCESS_KEY_ID,  secret: process.env.AWS_SECRET_ACCESS_KEY, bucket: bucketName });
  var headers = { 'Cache-Control': 'max-age=0, no-cache, must-revalidate, proxy-revalidate, private' };
  return gulp.src('./'+directory+'/**/*.*')
  .pipe(awspublish.gzip({ ext: '' }))
  .pipe(publisher.publish(headers))
  .pipe(publisher.cache())
  .pipe(awspublish.reporter());
}

gulp.task('build-local', function(callback) {
  buildAll('local', true, callback);
})

gulp.task('watch', function(callback) {
  for (var i=0; i<filelist.length; i++) {
    gulp.watch(filelist[i], ['build-local']);
  }
  gulp.watch('./blog/**/*.*', ['build-local']);
  gulp.watch('./site/data/*.json', ['build-local'])
  gulp.watch('./site/data/predictions/*.json', ['build-local'])
  callback();
});

gulp.task('serve-local', function(callback) {
  child_process.execFile('http-server', ['local'], function(error, stdout, stderr) {
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
  var environment = 'prod';
  buildAll(environment, true, function() {
    uploadToAws(environment,'www.traffichackers.com');
    uploadToAws(environment,'boston.traffichackers.com');
  });
});

gulp.task('dev', function() {
  var environment = 'dev'
  buildAll(environment, false, function() {
    uploadToAws(environment, 'dev.traffichackers.com');
  });
});

gulp.task('local', ['build-local', 'watch', 'serve-local'])

gulp.task('blog-prod', function() {
  var destination = 'build';
  del([destination+'/**'], function() {
    buildBlog(destination, function() {
    });
  });
})

gulp.task('blog-dev', function() {
  var environment = 'dev';
  del([environment+'/**'], function() {
    buildBlog(environment, function() {
      uploadToAws(environment,'dev.traffichackers.com');
    });
  });
})
