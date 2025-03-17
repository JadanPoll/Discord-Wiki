# What is going on?

I am working on refactoring our website. Specifically, I am trying to make the dataflow lot simpler by storing ALL data into localStorage, and using React for frontend matters, while Flask only handles API calls. [Read more here](https://blog.miguelgrinberg.com/post/how-to-create-a-react--flask-project).

Now all data should go to port 3000, where React handles requests. However, all routes not specified by React will be proxied into port 5000, where Flask lives.

# How to run?
In two separate sessions, run `yarn start` and `yarn start-api`. Each runs React and Flask, respectively.

# How are you going to deploy this?
I am looking into using Azure VPS, since it is free for students.