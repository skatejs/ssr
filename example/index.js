require('babel-register')({
  presets: ['react', 'stage-0'].map(m => require(`babel-preset-${m}`))
});

const { render } = require('../');
const Hapi = require('hapi');
const fs = require('fs');

const server = new Hapi.Server();
server.connection({ 
  host: 'localhost', 
  port: 8000 
});

server.route({
  method: 'GET',
  path: '/{page*}', 
  handler (request, response) {
    const page = `./pages/${request.params.page || 'index'}.js`;
    const Page = fs.existsSync(page) ? require(page) : require('./pages/404.js');
    return response(render(Object.assign(new Page(), request.params)));
  }
});

server.start((err) => {
    if (err) throw err;
    console.log('Server running at:', server.info.uri);
});
