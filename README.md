# hacking-travel
web ui for [hacking-travel-predictions](https://github.com/ecooper2/hacking-travel-predictions) and [hacking-travel-data](https://github.com/apcollier/hacking-travel-data)

## Developing Locally
Ensure that [Node.js](http://nodejs.org) is installed.  If needed, [Node.js](http://nodejs.org) can be through [homebrew](http://brew.sh) - after installing [homebrew](http://brew.sh), use the following command to install [Node.js](http://nodejs.org).
```
$ brew install node
```

Once you have [Node.js](http://nodejs.org) installed, perform the following:
```
$ git clone git@github.com:apcollier/hacking-travel.git
$ cd hacking-travel
$ npm install --global gulp
$ npm install --global http-server
$ npm install
$ sudo gem install jekyll
$ gulp build
```

Once Go to `localhost:8080` in your web browser, and you should see the
