import { PartialType } from "@nestjs/mapped-types";
import { CreateCommunityPostDto } from "./create-community-post.dto";

export class UpdateCommunityPostDto extends PartialType(CreateCommunityPostDto) {}
