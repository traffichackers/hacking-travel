# hacking-travel
web interface for [hacking-travel-predictions](https://github.com/ecooper2/hacking-travel-predictions) and [hacking-travel-data](https://github.com/apcollier/hacking-travel-data)

## Developing Locally
1.  Ensure that [Node.js](http://nodejs.org) is installed.  If needed, [Node.js](http://nodejs.org) can be installed via [homebrew](http://brew.sh).  After installing [homebrew](http://brew.sh), use the following command to install [Node.js](http://nodejs.org):
  ```
  $ brew install node
  ```

2.  Once you have [Node.js](http://nodejs.org) installed, clone and configure the code in this repository:
  ```
  $ git clone git@github.com:apcollier/hacking-travel.git
  $ cd hacking-travel
  $ npm install --global gulp
  $ npm install --global http-server
  $ npm install
  $ sudo gem install jekyll
  $ gulp dev
  ```

3.  Navigate to `localhost:8080` in your web browser.
