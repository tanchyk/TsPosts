import {
    Arg,
    Ctx,
    Field,
    FieldResolver,
    Int,
    Mutation,
    ObjectType,
    Query,
    Resolver,
    Root,
    UseMiddleware
} from "type-graphql";
import {Post} from "../entities/Post";
import {getConnection, getRepository} from "typeorm";
import {PostInput} from "./InputTypes";
import {MyContext} from "../types";
import {isAuth} from "../middleware/isAuth";
import {Upvote} from "../entities/Upvote";
import {User} from "../entities/User";

@ObjectType()
class PaginatedPosts {
    @Field(() => [Post])
    posts: Post[];
    @Field()
    hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
    @FieldResolver(() => User)
    creator(
        @Root() post: Post,
        @Ctx() {userLoader}: MyContext
    ) {
        return userLoader.load(post.creatorId);
    }

    @FieldResolver(() => Int, {nullable: true})
    async voteStatus (
        @Root() post: Post,
        @Ctx() {upvoteLoader, req}: MyContext
    ) {
        if(!req.session.userId) {
            return  null;
        }

        const upvote = await upvoteLoader.load({postId: post.id, userId: req.session.userId});

        return upvote ? upvote.value : null;
    }

    @FieldResolver(() => String)
    textSnippet(
        @Root() root: Post
    ) {
        if(root.text.length > 75) {
            let trimmedString = root.text.substr(0, 75);
            trimmedString = trimmedString.substr(0, Math.min(trimmedString.length, trimmedString.lastIndexOf(" ")))
            return trimmedString + ' ...';
        } else {
            return root.text;
        }
    }

    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async vote(
        @Arg('postId', () => Int) postId: number,
        @Arg('value', () => Int) value: number,
        @Ctx() {req}: MyContext
    ) {
        const realValue = value !== -1 ? 1 : -1;
        const {userId} = req.session;

        const upvote = await Upvote.findOne({where: {postId, userId}});

        if(upvote && upvote.value !== realValue) {
            await getConnection().transaction(async tm => {
                await tm.query(`
                    update upvote
                    set value = ${realValue}
                    where "postId" = ${postId} and "userId" = ${userId}
                `);

                await tm.query(`
                    update post
                    set points = points + ${2 * realValue}
                    where id = ${postId};
                `);
            });
        } else if(!upvote) {
            await getConnection().transaction(async tm => {
                await tm.query(`
                    insert into upvote ("userId", "postId", value)
                    values (${userId}, ${postId}, ${realValue});
                `);

                await tm.query(`
                    update post
                    set points = points + ${realValue}
                    where id = ${postId};
                `);
            });
        }

        return true;
    }

    @Query(() => PaginatedPosts)
    async posts(
        @Arg('limit', () => Int) limit: number,
        @Arg(
            'cursor',
            () => Date,
            {nullable: true}
            ) cursor: Date | null,
        @Ctx() {req}: MyContext
    ): Promise<PaginatedPosts> {
        const finalLimit = Math.min(50, limit);
        const replacements: any[] = [finalLimit + 1];

        if(req.session.userId) {
            replacements.push(req.session.userId);
        }

        let cursorIndex = 3
        if(cursor) {
            replacements.push(new Date(cursor));
            cursorIndex = replacements.length;
        }

        const posts = await getConnection().query(`
            select p.*,
            ${
            req.session.userId
                ? '(select value from upvote where "userId" = $2 and "postId" = p.id) "voteStatus"'
                : 'null as "voteStatus"'
            }
            from post p
            ${cursor ? `where p."createdAt" < $${cursorIndex}` : ""}
            order by p."createdAt" DESC
            limit $1
        `, replacements);

        return {
            hasMore: posts.length === limit + 1,
            posts: posts.slice(0, limit)
        }
    }

    @Query(() => Post, {nullable: true})
    post(
        @Arg('id', () => Int) id: number
    ): Promise<Post | undefined> {
        const postRepository = getRepository(Post);
        return postRepository.findOne({where: {id}});
    }

    @Mutation(() => Post)
    @UseMiddleware(isAuth)
    async createPost(
        @Arg('input') input: PostInput,
        @Ctx() {req}: MyContext
    ): Promise<Post> {

        const post = new Post();
        post.creatorId = req.session.userId;
        post.title = input.title;
        post.text = input.text;

        const postRepository = getRepository(Post);
        await postRepository.save(post);

        return post;
    }

    @Mutation(() => Post, {nullable: true})
    @UseMiddleware(isAuth)
    async updatePost(
        @Arg('id', () => Int) id: number,
        @Arg('title') title: string,
        @Arg('text') text: string
    ): Promise<Post | undefined> {
        const postRepository = getRepository(Post);
        const post = await postRepository.findOne({ where: {id}});
        if(!post) {
            return undefined;
        }
            post.title = title;
            post.text = text;
            await postRepository.save(post);
        return post;
    }

    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async deletePost(
        @Arg("id", () => Int) id: number,
        @Ctx() {req}: MyContext
    ): Promise<boolean> {
        try {
            const postRepository = getRepository(Post);
            await postRepository.delete({id, creatorId: req.session.userId});
        } catch (e) {
            return false
        }
        return true;
    }
}