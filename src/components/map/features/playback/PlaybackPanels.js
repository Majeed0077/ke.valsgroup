import PlaybackDrawer from "@/components/map/playback/PlaybackDrawer";
import PlaybackPrintModal from "@/components/map/playback/PlaybackPrintModal";
import PlaybackShareModal from "@/components/map/playback/PlaybackShareModal";
import PlaybackSettingsPanel from "@/components/map/playback/PlaybackSettingsPanel";
import PlaybackTopBar from "@/components/map/playback/PlaybackTopBar";
import {
  formatPlaybackDistance,
  formatPlaybackDuration,
  formatPlaybackSpeed,
  formatPlaybackStamp,
} from "@/components/map/mapHelpers";

export default function PlaybackPanels({
  selectedVehicle,
  selectedVehiclePlaybackActive,
  showPlaybackChrome = true,
  playbackTopbarMenuButtonRef,
  controller,
  metrics,
  handlePlaybackTopbarOpenObjectList,
  focusPlaybackRoute,
  playbackSettingsPanelStyle,
  handlePlaybackSettingsHeaderPointerDown,
  playbackCalculationOptions,
  playbackMinuteOptions,
  playbackSpeedFilterOptions,
  playbackSpeedLimitOptions,
  playbackAlertFilterOptions,
  playbackSeatBeltOptions,
  playbackShareValidityOptions,
  printPreviewMap,
}) {
  if (!selectedVehiclePlaybackActive || !selectedVehicle) return null;

  return (
    <>
      {showPlaybackChrome ? (
        <PlaybackTopBar
          ref={playbackTopbarMenuButtonRef}
          vehicleLabel={selectedVehicle.vehicle_no || selectedVehicle.imei_id || "Vehicle"}
          playbackRangeLabel={controller.playbackRangeLabel}
          isPlaybackSettingsCollapsed={controller.isPlaybackSettingsCollapsed}
          onOpenObjectList={handlePlaybackTopbarOpenObjectList}
          onTogglePlaybackMenu={controller.handleTogglePlaybackMenu}
          onPrint={controller.handlePlaybackPrint}
          onShare={controller.handlePlaybackShare}
          onFocus={focusPlaybackRoute}
          onToggleSettings={() => controller.setIsPlaybackSettingsCollapsed((current) => !current)}
          onClose={controller.handlePlaybackClose}
        />
      ) : null}

      <PlaybackShareModal
        isOpen={controller.isPlaybackShareModalOpen}
        playbackShareValidity={controller.playbackShareValidity}
        playbackShareEmails={controller.playbackShareEmails}
        playbackShareMobiles={controller.playbackShareMobiles}
        playbackShareReason={controller.playbackShareReason}
        playbackShareFeedback={controller.playbackShareFeedback}
        validityOptions={playbackShareValidityOptions}
        onClose={() => {
          controller.setIsPlaybackShareModalOpen(false);
          controller.setPlaybackShareFeedback("");
        }}
        onChangeValidity={(event) => {
          controller.setPlaybackShareValidity(event.target.value);
          controller.setPlaybackShareFeedback("");
        }}
        onChangeEmails={(event) => {
          controller.setPlaybackShareEmails(event.target.value);
          controller.setPlaybackShareFeedback("");
        }}
        onChangeMobiles={(event) => {
          controller.setPlaybackShareMobiles(event.target.value);
          controller.setPlaybackShareFeedback("");
        }}
        onChangeReason={(event) => {
          controller.setPlaybackShareReason(event.target.value.slice(0, 200));
          controller.setPlaybackShareFeedback("");
        }}
        onOpenHistory={controller.handlePlaybackShareHistory}
        onGenerateLink={controller.handlePlaybackGenerateLink}
        onSend={controller.handlePlaybackShareSend}
      />

      <PlaybackPrintModal
        isOpen={controller.isPlaybackPrintModalOpen}
        onClose={() => controller.setIsPlaybackPrintModalOpen(false)}
        onPrintMap={() => controller.handlePlaybackPrintAction("map")}
        onPrintReport={() => controller.handlePlaybackPrintAction("report")}
        onPrintMapWithReport={() => controller.handlePlaybackPrintAction("map-report")}
        previewMap={printPreviewMap}
      />

      {showPlaybackChrome ? (
        <PlaybackSettingsPanel
          isCollapsed={controller.isPlaybackSettingsCollapsed}
          style={playbackSettingsPanelStyle}
          onHeaderPointerDown={handlePlaybackSettingsHeaderPointerDown}
          onClose={() => controller.setIsPlaybackSettingsCollapsed(true)}
          playbackSettings={controller.playbackSettings}
          playbackThresholds={controller.playbackThresholds}
          playbackAlertSummary={controller.playbackAlertSummary}
          isAlertMenuOpen={controller.isPlaybackAlertMenuOpen}
          onToggleAlertMenu={() => controller.setIsPlaybackAlertMenuOpen((current) => !current)}
          onToggleAlertFilter={controller.togglePlaybackAlertFilter}
          onToggleSetting={controller.togglePlaybackSetting}
          onUpdateThreshold={controller.updatePlaybackThreshold}
          calculationOptions={playbackCalculationOptions}
          minuteOptions={playbackMinuteOptions}
          speedFilterOptions={playbackSpeedFilterOptions}
          speedLimitOptions={playbackSpeedLimitOptions}
          alertFilterOptions={playbackAlertFilterOptions}
          seatBeltOptions={playbackSeatBeltOptions}
          playbackRoutePointCount={controller.playbackRoutePath.length}
          playbackProgressPercent={Math.round(controller.playbackProgress * 100)}
          distanceLabel={formatPlaybackDistance(metrics.playbackDistanceMeters)}
          durationLabel={formatPlaybackDuration(metrics.playbackDurationMs)}
          stopsCount={metrics.playbackPointIndexes.length}
          showSettingsPrompt={controller.showPlaybackSettingsPrompt}
          onSaveSettings={controller.savePlaybackSettings}
          onRestoreSettings={controller.restorePlaybackSettings}
        />
      ) : null}

      {showPlaybackChrome ? (
        <PlaybackDrawer
          isOpen={controller.isPlaybackDrawerOpen}
          activeTab={controller.activePlaybackDrawerTab}
          onOpenTab={controller.openPlaybackDrawerTab}
          onToggleOpen={() => controller.setIsPlaybackDrawerOpen((current) => !current)}
          playbackTrips={metrics.playbackTrips}
          playbackEventRows={metrics.playbackEventRows}
          playbackSampleMetrics={metrics.playbackSampleMetrics}
          selectedVehicle={selectedVehicle}
          formatPlaybackStamp={formatPlaybackStamp}
          formatPlaybackSpeed={formatPlaybackSpeed}
          playbackSpeedChart={metrics.playbackSpeedChart}
          playbackFuelChart={metrics.playbackFuelChart}
          playbackTemperatureChart={metrics.playbackTemperatureChart}
          hasSpeedHistory={metrics.playbackSampleMetrics.length > 0}
          hasFuelHistory={metrics.playbackFuelSeries.length > 0}
          hasTemperatureHistory={Object.keys(metrics.playbackTemperatureSeries).length > 0}
          playbackSettings={controller.playbackSettings}
          playbackTemperatureSeries={metrics.playbackTemperatureSeries}
          activeTemperatureSensor={metrics.activeTemperatureSensor}
          onSetActiveTemperatureSensor={metrics.setActiveTemperatureSensor}
        />
      ) : null}
    </>
  );
}
