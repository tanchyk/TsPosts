import React, {useState} from "react";
import {withUrqlClient} from "next-urql";
import {createUrqlClient} from "../utils/createUrqlClient";
import {useDeletePostMutation, useMeQuery, usePostsQuery} from "../generated/graphql";
import {Box, Button, Flex, Heading, Link, Skeleton, Stack, Text, IconButton} from "@chakra-ui/react";
import {Layout} from "../components/Layout";
import NextLink from "next/link";
import {UpvoteSection} from "../components/UpvoteSection";
import {DeleteIcon, EditIcon} from "@chakra-ui/icons";

const Index: React.FC = () => {
    const [variables, setVariables] = useState({limit: 10, cursor: null as string | null});
    const [{data, fetching}] = usePostsQuery({
        variables: variables
    });
    const [, deletePost] = useDeletePostMutation();
    const [{data: meData}] = useMeQuery();

    const loadMore = () => {
        setVariables({
            limit: variables.limit,
            cursor: data?.posts.posts[data?.posts.posts.length - 1].createdAt
        })
    }

    if (!fetching && !data) {
        return <Heading>404</Heading>
    }

    return (
        <Layout>
            <Flex mt={8} mb={8} alignItems="center">
                <Heading>Community Posts</Heading>
                <NextLink href="/create-post">
                    <Link ml="auto">Create Post</Link>
                </NextLink>
            </Flex>
            {
                data && !fetching ? (
                    <Stack spacing={8} my={8}>
                        {
                            data.posts.posts.map((post) => !post ? null : (
                                <Flex key={post.id} p={5} shadow="md" borderWidth="1px">
                                    <UpvoteSection post={post} />
                                    <Box>
                                        <NextLink href='/post/[id]' as={`/post/${post.id}`}>
                                            <Link>
                                                <Heading fontSize="xl">{post.title}</Heading>
                                            </Link>
                                        </NextLink>
                                        <Text mt={2}>Posted by {post.creator.username}</Text>
                                        <Text mt={4}>{post.textSnippet}</Text>
                                    </Box>
                                    {
                                        meData?.me && meData.me.id === post.creator.id ? (
                                            <Stack spacing={2} ml="auto">
                                                <IconButton
                                                    size="sm"
                                                    aria-label="Delete Post"
                                                    icon={<DeleteIcon/>}
                                                    onClick={() => {
                                                        deletePost({
                                                            id: post.id
                                                        })
                                                    }}
                                                />
                                                <NextLink href="/post/edit/[id]" as={`/post/edit/${post.id}`}>
                                                    <IconButton
                                                        as={Link}
                                                        size="sm"
                                                        aria-label="Edit Post"
                                                        icon={<EditIcon/>}
                                                    />
                                                </NextLink>
                                            </Stack>
                                        ) : null
                                    }
                                </Flex>
                            ))
                        }
                    </Stack>
                ) : (
                    <Stack my={8}>
                        <Skeleton height="60px"/>
                        <Skeleton height="60px"/>
                        <Skeleton height="60px"/>
                        <Skeleton height="60px"/>
                        <Skeleton height="60px"/>
                    </Stack>
                )
            }
            {
                data && data.posts.hasMore ? (
                    <Button isLoading={fetching} my={8} onClick={loadMore}>
                        Load More
                    </Button>
                ) : (
                    <Heading my={8}>No more posts</Heading>
                )
            }
        </Layout>
    )
}

export default withUrqlClient(createUrqlClient, {ssr: true})(Index)
