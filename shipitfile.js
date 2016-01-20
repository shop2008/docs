
var copyObject = require('copy-object');
var gitHelper = require('./git-helper');
var fs = require('fs');

var env = JSON.parse(fs.readFileSync('.env.json'));

module.exports = function (shipit) {
  require('shipit-deploy')(shipit);

  var
    gitInfo = gitHelper.getLocalInfo(),
    config = {
      servers: 'deploy@142.4.202.189:22022',
      workspace: '/tmp/docs-pro.handsontable.com/' + gitInfo.branch,
      repositoryUrl: 'git@github.com:handsontable/docs-pro.git',
      branch: gitInfo.branch,
      ignores: ['.git', 'node_modules'],
      rsync: ['--force', '--delete', '--delete-excluded', '-I', '--stats', '--chmod=ug=rwX'],
      keepReleases: 3,
      shallowClone: false
    };

  shipit.initConfig({
    production: (function() {
      config = copyObject(config);
      config.deployTo = '/home/httpd/docs-pro.handsontable.com/' + gitInfo.branch;

      return config;
    }()),
    development: (function() {
      config = copyObject(config);
      config.deployTo = '/home/httpd/dev-docs-pro.handsontable.com/' + gitInfo.branch;
      config.keepReleases = 1;

      return config;
    }())
  });

  shipit.task('test', function() {
    shipit.remote('pwd');
  });

  shipit.blTask('deploy', [
    'deploy:init',
    'deploy:fetch',
    'deploy:update'
  ]);

  shipit.on('updated', function() {
    var path = shipit.releasePath;

    shipit.remote('cd ' + path + ' && npm install --production').then(function() {
      return shipit.remote('cd ' + path + ' && cp ../../../web.env .env.json');

    }).then(function() {
      return shipit.remote('cd ' + path + ' && grunt --hot-pro-version=' + gitInfo.branch);

    }).then(function() {
      gitHelper.setupGitApi(env.GITHUB_TOKEN, env.GITLAB_TOKEN);

      return gitHelper.getHotLatestRelease();

    }).then(function(objectInfo) {
      if (!objectInfo) {
        console.warn('Error retrieving the latest hot version from github.');

        return;
      }

      return shipit.remote('cd ' + shipit.config.deployTo + '/../ && echo "' + objectInfo.name + '" > latestHot');

    }).then(function() {
      shipit.start(['deploy:publish', 'deploy:clean']);
    });
  });
};