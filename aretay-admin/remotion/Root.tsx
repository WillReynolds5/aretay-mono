import { Composition } from "remotion";
import { CourseVideo, type CourseVideoProps } from "./CourseVideo";

export function RemotionRoot() {
  return (
    <Composition
      id="CourseVideo"
      component={CourseVideo}
      durationInFrames={180}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: "My Course",
        description: "A great course about something interesting.",
        coverImageUrl: null,
      } satisfies CourseVideoProps}
    />
  );
}
