const { src, dest, watch, series, parallel } = require('gulp');
const browserify = require('browserify');
const tsify = require('tsify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require("gulp-uglify");
const { merge } = require('event-stream');
const replace = require('gulp-replace');
const sass = require('gulp-sass');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const browserSync = require('browser-sync').create()

const typescriptSettings = {
  src: ['src/engine/**/*.ts', 'src/game/**/*.ts']
}

const bundleSettings = {
  entries: [
    {
      src: 'src/engine/main.ts',
      output: 'engine.development.bundle.js',
      dest: 'dist/engine'
    },
    {
      src: 'src/game/app.ts',
      output: 'game.development.bundle.js',
      dest: 'dist/game'
    }
  ]
}

const staticSettings = {
  entries: [
    {
      src: ['src/game/index.html'],
      dest: 'dist/game',
      base: 'src/game'
    }
  ]
}

const cacheBustSettings = {
  entries: staticSettings.entries
}

const scssSettings = {
  entries: [
    {
      src: 'src/game/style.scss',
      dest: 'dist/game'
    }
  ]
}

const browserSettings = {
  src: ['dist/game/**/*.(html|js|css)'],
  dest: 'dist/game'
}

const watchPath = typescriptSettings.src.concat(
  scssSettings.entries.map(p => p.src),
  staticSettings.entries.map(p => p.src[0])
);

function bundleTask(done) {
  const tasks = bundleSettings.entries.map((entry) => {
    return browserify({
      basedir: '.',
      debug: true,
      entries: [entry.src],
      cache: {},
      packageCache: {}
    })
      .plugin(tsify)
      .bundle()
      .pipe(source(entry.output))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(uglify())
      .pipe(sourcemaps.write('./'))
      .pipe(dest(entry.dest));
  })

  return merge(tasks).on('end', done);
}

function staticTask(done) {
  const tasks = staticSettings.entries.map((entry) => {
    return src(entry.src, { base: entry.base })
      .pipe(
        dest(entry.dest)
      );
  });

  return merge(tasks).on('end', done);
}

function cacheBustTask(done) {
  var cbString = new Date().getTime();
  const tasks = cacheBustSettings.entries.map((entry) => {
    return src(entry.src)
      .pipe(replace(/cb=\d+/g, 'cb=' + cbString))
      .pipe(dest(entry.dest));
  });

  return merge(tasks).on('end', done);
}

function scssTask(done) {
  const tasks = scssSettings.entries.map((entry) => {
    return src(entry.src)
      .pipe(sourcemaps.init())
      .pipe(sass())
      .pipe(postcss([autoprefixer(), cssnano()]))
      .pipe(sourcemaps.write('.'))
      .pipe(dest(entry.dest));
  });

  return merge(tasks).on('end', done);
}

function browserSyncTask() {
  browserSync.init({
    files: browserSettings.src,
    server: {
      baseDir: browserSettings.dest,
      directory: true
    }
  });
}

function watchTask() {
  watch(
    watchPath,
    { interval: 1000, usePolling: true }, // Makes docker work
    series(
      parallel(scssTask, bundleTask, staticTask),
      cacheBustTask
    )
  );
}

exports.default = series(
  parallel(scssTask, bundleTask, staticTask),
  cacheBustTask,
  watchTask
);

exports.browserSync = series(browserSyncTask);

exports.build = series(
  parallel(scssTask, bundleTask, staticTask),
  cacheBustTask
);
