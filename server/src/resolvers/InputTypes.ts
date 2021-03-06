import {Field, InputType, ObjectType} from "type-graphql";
import {User} from "../entities/User";

@InputType()
export class UserInput {
    @Field()
    username: string;
    @Field()
    email: string;
    @Field()
    password: string;
}

@ObjectType()
export class FieldError {
    @Field()
    field: string;
    @Field()
    message: string;
}

@ObjectType()
export class UserResponse {
    @Field(() => [FieldError], {nullable: true})
    errors?: FieldError[];
    @Field(() => User, {nullable: true})
    user?: User;
}

@InputType()
export class PostInput {
    @Field()
    title: string;
    @Field()
    text: string;
}