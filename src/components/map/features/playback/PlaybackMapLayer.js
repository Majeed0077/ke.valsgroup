import BasePlaybackMapLayer from "@/components/map/PlaybackMapLayer";

export default function PlaybackMapLayer({ playbackScene }) {
  const visibleRoutePath =
    playbackScene.playbackRoutePath.length >= 2
      ? playbackScene.playbackRoutePath
      : playbackScene.rawPlaybackRoutePath.length >= 2
        ? playbackScene.rawPlaybackRoutePath
        : [];

  return (
    <BasePlaybackMapLayer
      shouldRenderPlaybackMapState={playbackScene.shouldRenderPlaybackMapState}
      playbackSettings={playbackScene.playbackSettings}
      playbackRoutePath={visibleRoutePath}
      playbackRouteStyle={playbackScene.playbackRouteStyle}
      playbackVisibleDataPoints={playbackScene.playbackVisibleDataPoints}
      playbackDataPointRadius={playbackScene.playbackDataPointRadius}
      playbackVisibleEventDescriptors={playbackScene.playbackVisibleEventDescriptors}
      playbackMarkerPresentation={playbackScene.playbackMarkerPresentation}
    />
  );
}
