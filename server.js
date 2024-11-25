/**
 * This is the main Node.js server script for your project.
 */

const path = require("path");
const cmd = require('node-cmd');
const crypto = require('crypto');
const fastify = require("fastify")({
  logger: false,
});

const axios = require("axios");


// Webhook handler
const onWebhook = (req, reply) => {
  let hmac = crypto.createHmac('sha1', process.env.SECRET);
  let sig = `sha1=${hmac.update(JSON.stringify(req.body)).digest('hex')}`;

  if (req.headers['x-github-event'] === 'push' && sig === req.headers['x-hub-signature']) {
    cmd.run('chmod 777 ./git.sh');

    cmd.get('./git.sh', (err, data) => {
      if (data) {
        console.log(data);
      }
      if (err) {
        console.log(err);
      }
    });

    cmd.run('refresh');
  }

  reply.sendStatus(200);
};

// GitHub webhook endpoint
fastify.post('/git', onWebhook);

// Enable CORS for all requests
fastify.register(require('@fastify/cors'), {
  origin: "*", // Adjust this for production
});

// CORS bypass route for proxying requests
fastify.route({
  method: ['GET', 'POST', 'PUT', 'DELETE'],
  url: '/cors-bypass/*',
  handler: async (request, reply) => {
    try {
      const targetUrl = request.params['*'];
      if (!targetUrl) {
        return reply.status(400).send({ error: 'Target URL is required' });
      }

      const authHeader = request.headers.authorization;

      const response = await axios({
        method: request.method,
        url: targetUrl,
        headers: {
          Authorization: authHeader,
        },
      });

      reply.status(response.status).send(response.data);
    } catch (error) {
      console.error('Error forwarding request:', error);
      reply.status(error.response?.status || 500).send({
        error: error.message,
        ...(error.response?.data && { details: error.response.data }),
      });
    }
  },
});

// Setup static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, ""),
  prefix: "/",
});

// Run the server and log the address
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
