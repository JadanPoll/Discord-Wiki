# What is going on?

I am working on refactoring our website. Specifically, I am trying to make the dataflow lot simpler by storing ALL data into localStorage, and using React for frontend matters, while Flask only handles API calls. [Read more here](https://blog.miguelgrinberg.com/post/how-to-create-a-react--flask-project).

Now all data should go to port 3000, where React handles requests. However, all routes not specified by React will be proxied into port 5000, where Flask lives.

# How do I run this?
First, run `yarn install` to install all the dependencies.

In two separate sessions, run `yarn start` and `yarn start-api`. Each runs React and Flask, respectively.

Then, using a reverse proxy of your choice, proxy routes `/cors-bypass` and `git` to 5000 port (Flask). Proxy all other routes to 3000 flask (React). An example configuration would be (Apache httpd)
```
<VirtualHost *:8080>
	ServerName 127.0.0.1
    ProxyPass "/cors-bypass/" "http://localhost:5000/cors-bypass/" nocanon
    ProxyPassReverse "/cors-bypass/" "http://localhost:5000/cors-bypass/" nocanon

    ProxyPass "/git/" "http://localhost:5000/git/"
    ProxyPassReverse "/git/" "http://localhost:5000/git/"

    ProxyPass "/" "http://localhost:3000/"
    ProxyPassReverse "/" "http://localhost:3000/"

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
```

# How are you going to deploy this?
I am looking into using Azure VPS, since it is free for students.