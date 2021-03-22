import "reflect-metadata";
require('dotenv').config();
import {MikroORM} from "@mikro-orm/core";
import microConfig from './mikro-orm.config';
import express from 'express';
import {ApolloServer} from 'apollo-server-express';
import {buildSchema} from 'type-graphql';
import cors from 'cors';

import Redis from "ioredis";
import session from "express-session";
import connectRedis from 'connect-redis';

import {HelloResolver} from "./resolvers/hello";
import {PostResolver} from "./resolvers/post";
import {UserResolver} from "./resolvers/user";
import {__prod__} from "./constants";
import {MyContext} from "./types";

const app = async () => {
    const orm = await MikroORM.init(microConfig);
    await orm.getMigrator().up();

    const app = express();

    const RedisStore = connectRedis(session);
    const redis = new Redis();

    app.use(
        cors({
            origin: "http://localhost:3000",
            credentials: true
        })
    );

    app.use(
        session({
            name: 'qid',
            store: new RedisStore({
                client: redis,
                disableTouch: true
            }),
            cookie: {
                maxAge: 1000 * 60 * 60 * 24 * 90, //3 month
                httpOnly: true,
                sameSite: "lax",
                secure: false
            },
            saveUninitialized: false,
            secret: `${process.env.REDIS_SECRET}`,
            resave: false
        })
    )

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver, PostResolver, UserResolver],
            validate: false
        }),
        context: ({req, res}: MyContext): MyContext => ({em: orm.em, req, res})
    });

    apolloServer.applyMiddleware({
        app,
        cors: false
    });

    app.listen(4000, () => {
        console.log("Done! http://localhost:4000/graphql");
    });
}

app();