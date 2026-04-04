import { CommunityController } from "../src/community/community.controller";
import { CommunityService } from "../src/community/community.service";

describe("CommunityController (e2e)", () => {
  it("커뮤니티 게시글 목록 조회를 서비스에 위임한다", async () => {
    const communityService = {
      listPosts: jest.fn().mockResolvedValue([
        {
          id: "post-1",
          title: "전기차 화재 관련 보도의 객관성 토론",
          content:
            "최근 연이어 발생하는 전기차 화재 사고에 대한 언론 보도가 공포심을 조장하고 있다는 의견이 있습니다.",
          category: "Issue",
          author: {
            name: "김철수",
            gender: "남",
            ageGroup: "30대",
          },
          createdAt: "2026-04-02T02:00:00.000Z",
          likeCount: 45,
          commentCount: 12,
          isAuthor: false,
          likedByMe: false,
        },
      ]),
    } as unknown as CommunityService;
    const controller = new CommunityController(communityService);

    const result = await controller.listPosts({
      user: { id: "user-1" },
    });

    expect(result).toHaveLength(1);
    expect(communityService.listPosts).toHaveBeenCalledWith("user-1");
  });

  it("커뮤니티 게시글 상세 조회를 서비스에 위임한다", async () => {
    const communityService = {
      getPostDetail: jest.fn().mockResolvedValue({
        id: "post-1",
        title: "전기차 화재 관련 보도의 객관성 토론",
        content:
          "최근 연이어 발생하는 전기차 화재 사고에 대한 언론 보도가 공포심을 조장하고 있다는 의견이 있습니다.",
        category: "Issue",
        author: {
          name: "김철수",
          gender: "남",
          ageGroup: "30대",
        },
        createdAt: "2026-04-02T02:00:00.000Z",
        likeCount: 45,
        commentCount: 12,
        isAuthor: true,
        likedByMe: true,
        comments: [
          {
            id: "comment-1",
            postId: "post-1",
            parentCommentId: null,
            author: {
              name: "정민수",
              gender: "남",
              ageGroup: "30대",
            },
            content: "보도 자료를 보면 배터리 제조사만 강조하고 실제 관리 부실에 대한 언급은 적은 것 같아요.",
            createdAt: "2026-04-02T03:30:00.000Z",
            isAuthor: false,
            likeCount: 1,
            likedByMe: false,
            replies: [],
          },
        ],
      }),
    } as unknown as CommunityService;
    const controller = new CommunityController(communityService);

    const result = await controller.getPostDetail(
      {
        user: { id: "user-1" },
      },
      "post-1",
    );

    expect(result.id).toBe("post-1");
    expect(communityService.getPostDetail).toHaveBeenCalledWith("user-1", "post-1");
  });

  it("커뮤니티 게시글 작성 요청을 서비스에 위임한다", async () => {
    const communityService = {
      createPost: jest.fn().mockResolvedValue({
        id: "post-1",
      }),
    } as unknown as CommunityService;
    const controller = new CommunityController(communityService);

    await controller.createPost(
      {
        user: { id: "user-1" },
        profile: {
          realName: "홍길동",
          gender: "남성",
          ageRange: "30대",
        },
      },
      {
        category: "Issue",
        title: "테스트 제목",
        content: "테스트 본문",
      },
    );

    expect(communityService.createPost).toHaveBeenCalledWith(
      "user-1",
      {
        realName: "홍길동",
        gender: "남성",
        ageRange: "30대",
      },
      {
        category: "Issue",
        title: "테스트 제목",
        content: "테스트 본문",
      },
    );
  });

  it("댓글 작성 요청을 서비스에 위임한다", async () => {
    const communityService = {
      createComment: jest.fn().mockResolvedValue({
        id: "post-1",
      }),
    } as unknown as CommunityService;
    const controller = new CommunityController(communityService);

    await controller.createComment(
      {
        user: { id: "user-1" },
        profile: {
          realName: "홍길동",
          gender: "남성",
          ageRange: "30대",
        },
      },
      "post-1",
      {
        content: "테스트 댓글",
        parentCommentId: "comment-1",
      },
    );

    expect(communityService.createComment).toHaveBeenCalledWith(
      "user-1",
      {
        realName: "홍길동",
        gender: "남성",
        ageRange: "30대",
      },
      "post-1",
      {
        content: "테스트 댓글",
        parentCommentId: "comment-1",
      },
    );
  });

  it("댓글 삭제 요청을 서비스에 위임한다", async () => {
    const communityService = {
      deleteComment: jest.fn().mockResolvedValue({
        id: "post-1",
      }),
    } as unknown as CommunityService;
    const controller = new CommunityController(communityService);

    await controller.deleteComment(
      {
        user: { id: "user-1" },
      },
      "post-1",
      "comment-1",
    );

    expect(communityService.deleteComment).toHaveBeenCalledWith(
      "user-1",
      "post-1",
      "comment-1",
    );
  });

  it("댓글 좋아요 요청을 서비스에 위임한다", async () => {
    const communityService = {
      addCommentLike: jest.fn().mockResolvedValue({
        likeCount: 2,
        likedByMe: true,
      }),
    } as unknown as CommunityService;
    const controller = new CommunityController(communityService);

    const result = await controller.addCommentLike(
      {
        user: { id: "user-1" },
      },
      "post-1",
      "comment-1",
    );

    expect(result.likedByMe).toBe(true);
    expect(communityService.addCommentLike).toHaveBeenCalledWith(
      "user-1",
      "post-1",
      "comment-1",
    );
  });
});
