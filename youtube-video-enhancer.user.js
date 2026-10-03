// ==UserScript==
// @name         YouTube Low-Lag Video Enhancer
// @namespace    youtube-enhancer
// @version      11.0
// @description  Lightweight YouTube video enhancement designed for low-end PCs
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const PANEL_ID = 'yt-low-lag-sharpness';
    const STYLE_ID = 'yt-enhancer-styles';

    const DEFAULT_STRENGTH = 25;
    const DEFAULT_PRESET = 'custom';
    const DEFAULT_AUTO = false;

    let panel = null;
    let slider = null;
    let valueLabel = null;
    let presetSelect = null;
    let autoCheckbox = null;
    let statusLabel = null;

    let currentVideo = null;
    let currentStrength = DEFAULT_STRENGTH;
    let currentPreset = DEFAULT_PRESET;
    let autoEnhance = DEFAULT_AUTO;

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    let lastVideoWidth = 0;
    let lastVideoHeight = 0;

    /*
     * The important fullscreen position state.
     *
     * normalPosition = the last known position while NOT fullscreen.
     *
     * We deliberately do not modify this position while fullscreen.
     * This prevents YouTube fullscreen resizing from moving the panel.
     */
    let normalPosition = null;

    let restorePositionTimer = null;

    /*
     * Load settings
     */
    currentStrength = clamp(
        Number(
            GM_getValue(
                'ytEnhancerStrength',
                GM_getValue(
                    'ytSharpness',
                    DEFAULT_STRENGTH
                )
            )
        ) || DEFAULT_STRENGTH,
        0,
        100
    );

    currentPreset = GM_getValue(
        'ytEnhancerPreset',
        DEFAULT_PRESET
    );

    autoEnhance = GM_getValue(
        'ytEnhancerAuto',
        DEFAULT_AUTO
    );

    /*
     * ------------------------------------------------------------
     * Utility
     * ------------------------------------------------------------
     */

    function clamp(value, min, max) {
        return Math.min(
            Math.max(value, min),
            max
        );
    }

    function getVideo() {
        return (
            document.querySelector(
                'video.html5-main-video'
            ) ||
            document.querySelector('video')
        );
    }

    function getResolution(video) {
        if (!video) {
            return null;
        }

        const width = video.videoWidth || 0;
        const height = video.videoHeight || 0;

        if (!width || !height) {
            return null;
        }

        return {
            width,
            height
        };
    }

    /*
     * ------------------------------------------------------------
     * Enhancement
     * ------------------------------------------------------------
     */

    function getAutoMultiplier(video) {
        const resolution = getResolution(video);

        if (!resolution) {
            return 1;
        }

        const height = resolution.height;

        if (height <= 144) {
            return 1.80;
        }

        if (height <= 240) {
            return 1.70;
        }

        if (height <= 360) {
            return 1.50;
        }

        if (height <= 480) {
            return 1.35;
        }

        if (height <= 720) {
            return 1.15;
        }

        if (height <= 1080) {
            return 1.00;
        }

        if (height <= 1440) {
            return 0.90;
        }

        return 0.80;
    }

    function getEffectiveStrength(
        video = currentVideo
    ) {
        if (autoEnhance) {
            const baseStrength =
                DEFAULT_STRENGTH;

            return clamp(
                Math.round(
                    baseStrength *
                    getAutoMultiplier(video)
                ),
                0,
                100
            );
        }

        return clamp(
            Math.round(currentStrength),
            0,
            100
        );
    }

    function getPresetStrength(preset) {
        switch (preset) {
            case 'natural':
                return 18;

            case 'clear':
                return 32;

            case 'strong':
                return 48;

            case 'custom':
            default:
                return currentStrength;
        }
    }

    function applyEnhancement(
        video = getVideo()
    ) {
        if (!video) {
            updateUI();
            return;
        }

        currentVideo = video;

        const amount =
            getEffectiveStrength(video);

        if (amount <= 0) {
            video.style.removeProperty('filter');
            updateUI();
            return;
        }

        const normalized =
            amount / 100;

        const contrast =
            1 + normalized * 0.30;

        const brightness =
            1 - normalized * 0.012;

        const saturation =
            1 + normalized * 0.035;

        video.style.setProperty(
            'filter',
            `contrast(${contrast.toFixed(3)}) brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)})`,
            'important'
        );

        updateUI();
    }

    /*
     * ------------------------------------------------------------
     * Settings
     * ------------------------------------------------------------
     */

    function enableAuto() {
        autoEnhance = true;

        GM_setValue(
            'ytEnhancerAuto',
            true
        );

        if (slider) {
            slider.disabled = true;
        }

        if (presetSelect) {
            presetSelect.disabled = true;
        }

        updateUI();

        applyEnhancement(
            currentVideo || getVideo()
        );
    }

    function selectManualMode(preset) {
        autoEnhance = false;

        GM_setValue(
            'ytEnhancerAuto',
            false
        );

        currentPreset = preset;

        if (preset !== 'custom') {
            currentStrength =
                getPresetStrength(preset);
        }

        GM_setValue(
            'ytEnhancerPreset',
            currentPreset
        );

        GM_setValue(
            'ytEnhancerStrength',
            currentStrength
        );

        if (slider) {
            slider.disabled = false;
        }

        if (presetSelect) {
            presetSelect.disabled = false;
            presetSelect.value =
                currentPreset;
        }

        updateUI();

        applyEnhancement(
            currentVideo || getVideo()
        );
    }

    function saveStrength() {
        GM_setValue(
            'ytEnhancerStrength',
            currentStrength
        );

        GM_setValue(
            'ytSharpness',
            currentStrength
        );
    }

    /*
     * ------------------------------------------------------------
     * UI information
     * ------------------------------------------------------------
     */

    function getResolutionText(video) {
        const resolution =
            getResolution(video);

        if (!resolution) {
            return 'NO VIDEO';
        }

        return `${resolution.width}×${resolution.height}`;
    }

    function getQualityLabel(video) {
        const resolution =
            getResolution(video);

        if (!resolution) {
            return 'UNKNOWN';
        }

        const height =
            resolution.height;

        if (height <= 144) {
            return '144P';
        }

        if (height <= 240) {
            return '240P';
        }

        if (height <= 360) {
            return '360P';
        }

        if (height <= 480) {
            return '480P';
        }

        if (height <= 720) {
            return '720P';
        }

        if (height <= 1080) {
            return '1080P';
        }

        if (height <= 1440) {
            return '1440P';
        }

        return '4K+';
    }

    function updateUI() {
        if (!panel) {
            return;
        }

        if (slider) {
            slider.value =
                String(currentStrength);

            slider.disabled =
                autoEnhance;
        }

        if (valueLabel) {
            valueLabel.textContent =
                autoEnhance
                    ? 'AUTO'
                    : `${currentStrength}%`;
        }

        if (presetSelect) {
            presetSelect.value =
                currentPreset;

            presetSelect.disabled =
                autoEnhance;
        }

        if (autoCheckbox) {
            autoCheckbox.checked =
                autoEnhance;
        }

        if (statusLabel) {
            if (autoEnhance) {
                const quality =
                    getQualityLabel(
                        currentVideo
                    );

                const effective =
                    getEffectiveStrength(
                        currentVideo
                    );

                statusLabel.textContent =
                    `AUTO • ${quality} • ${effective}%`;
            } else {
                const resolution =
                    getResolutionText(
                        currentVideo
                    );

                statusLabel.textContent =
                    `MANUAL • ${resolution} • ${currentStrength}%`;
            }
        }
    }

    /*
     * ------------------------------------------------------------
     * Position handling
     * ------------------------------------------------------------
     *
     * This is intentionally separate from fullscreen handling.
     */

    function getPanelPosition() {
        if (!panel) {
            return null;
        }

        const rect =
            panel.getBoundingClientRect();

        return {
            left: Math.round(rect.left),
            top: Math.round(rect.top)
        };
    }

    function saveNormalPosition() {
        if (
            !panel ||
            document.fullscreenElement
        ) {
            return;
        }

        const position =
            getPanelPosition();

        if (!position) {
            return;
        }

        normalPosition = position;

        GM_setValue(
            'ytEnhancerPosition',
            position
        );
    }

    function loadNormalPosition() {
        const saved =
            GM_getValue(
                'ytEnhancerPosition',
                null
            );

        if (
            saved &&
            typeof saved.left === 'number' &&
            typeof saved.top === 'number'
        ) {
            normalPosition = {
                left: saved.left,
                top: saved.top
            };
        }
    }

    /*
     * Clamp the panel only when necessary.
     *
     * This does NOT constantly rewrite the saved position.
     * That is important for fullscreen transitions.
     */
    function keepInsideScreen() {
        if (
            !panel ||
            document.fullscreenElement
        ) {
            return;
        }

        const rect =
            panel.getBoundingClientRect();

        const maxLeft =
            Math.max(
                0,
                window.innerWidth -
                rect.width
            );

        const maxTop =
            Math.max(
                0,
                window.innerHeight -
                rect.height
            );

        const left =
            clamp(
                rect.left,
                0,
                maxLeft
            );

        const top =
            clamp(
                rect.top,
                0,
                maxTop
            );

        if (
            Math.round(rect.left) !==
                Math.round(left) ||
            Math.round(rect.top) !==
                Math.round(top)
        ) {
            panel.style.left =
                `${left}px`;

            panel.style.top =
                `${top}px`;

            panel.style.right =
                'auto';

            panel.style.bottom =
                'auto';
        }
    }

    /*
     * Restore the user's normal-screen position.
     *
     * IMPORTANT:
     * We restore from normalPosition rather than calculating
     * a new position from the fullscreen viewport.
     */
    function restoreNormalPosition() {
        if (
            !panel ||
            document.fullscreenElement
        ) {
            return;
        }

        if (!normalPosition) {
            loadNormalPosition();
        }

        if (
            normalPosition &&
            typeof normalPosition.left === 'number' &&
            typeof normalPosition.top === 'number'
        ) {
            panel.style.left =
                `${normalPosition.left}px`;

            panel.style.top =
                `${normalPosition.top}px`;

            panel.style.right =
                'auto';

            panel.style.bottom =
                'auto';
        } else {
            panel.style.right =
                '18px';

            panel.style.bottom =
                '18px';

            panel.style.left =
                'auto';

            panel.style.top =
                'auto';
        }

        /*
         * Give the browser one frame to calculate the panel
         * after fullscreen has ended, then only clamp if it
         * genuinely ended up outside the screen.
         */
        requestAnimationFrame(() => {
            if (
                document.fullscreenElement ||
                !panel
            ) {
                return;
            }

            keepInsideScreen();
        });
    }

    /*
     * ------------------------------------------------------------
     * Styles
     * ------------------------------------------------------------
     */

    function createStyles() {
        if (
            document.getElementById(
                STYLE_ID
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            STYLE_ID;

        style.textContent = `
            #${PANEL_ID} {
                position: fixed;
                z-index: 2147483647;

                width: 46px;
                height: 46px;

                box-sizing: border-box;

                background: rgba(15, 15, 18, 0.96);

                border: 1px solid rgba(255, 255, 255, 0.10);
                border-radius: 14px;

                box-shadow:
                    0 8px 28px rgba(0, 0, 0, 0.42),
                    0 1px 2px rgba(0, 0, 0, 0.45);

                color: #f4f4f5;

                overflow: hidden;

                font-family:
                    Inter,
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    Roboto,
                    Arial,
                    sans-serif;

                user-select: none;
                -webkit-user-select: none;

                cursor: default;

                transition:
                    width 0.16s ease,
                    height 0.16s ease,
                    border-radius 0.16s ease,
                    box-shadow 0.16s ease;
            }

            #${PANEL_ID} * {
                user-select: none !important;
                -webkit-user-select: none !important;
            }

            #${PANEL_ID}:hover {
                width: 300px;
                height: 188px;

                border-radius: 15px;

                box-shadow:
                    0 12px 38px rgba(0, 0, 0, 0.50),
                    0 2px 5px rgba(0, 0, 0, 0.40);
            }

            #${PANEL_ID} .yt-enhancer-drag-handle {
                position: absolute;

                top: 0;
                left: 0;

                width: 46px;
                height: 46px;

                display: flex;
                align-items: center;
                justify-content: center;

                box-sizing: border-box;

                color: #ffffff;

                font-size: 21px;
                font-weight: 500;

                cursor: grab;

                user-select: none;
                -webkit-user-select: none;

                opacity: 0.92;

                z-index: 10;
            }

            #${PANEL_ID} .yt-enhancer-drag-handle:hover {
                opacity: 0.65;
            }

            #${PANEL_ID} .yt-enhancer-drag-handle:active {
                cursor: grabbing;
            }

            #${PANEL_ID} .yt-enhancer-content {
                position: absolute;

                top: 0;
                left: 46px;

                width: 254px;
                height: 188px;

                padding: 13px 14px 12px 10px;

                box-sizing: border-box;

                opacity: 0;
                visibility: hidden;

                pointer-events: none;

                transition:
                    opacity 0.10s ease,
                    visibility 0.10s ease;
            }

            #${PANEL_ID}:hover .yt-enhancer-content {
                opacity: 1;
                visibility: visible;
                pointer-events: auto;
            }

            #${PANEL_ID} .yt-enhancer-header {
                display: flex;
                align-items: center;
                justify-content: space-between;

                height: 27px;

                margin-bottom: 8px;
            }

            #${PANEL_ID} .yt-enhancer-title {
                font-size: 14px;
                font-weight: 650;

                letter-spacing: 0.1px;

                white-space: nowrap;
            }

            #${PANEL_ID} .yt-enhancer-value {
                min-width: 40px;

                text-align: right;

                font-size: 12px;
                font-weight: 600;

                color: rgba(255, 255, 255, 0.70);
            }

            #${PANEL_ID} .yt-enhancer-preset {
                width: 100%;
                height: 30px;

                box-sizing: border-box;

                margin-bottom: 9px;
                padding: 0 9px;

                border: 1px solid rgba(255, 255, 255, 0.10);
                border-radius: 8px;

                outline: none;

                background: #202024;
                color: #f2f2f2;

                font-size: 11px;

                cursor: pointer;

                appearance: auto;

                transition:
                    opacity 0.12s ease;
            }

            #${PANEL_ID} .yt-enhancer-preset:hover:not(:disabled) {
                background: #28282d;
            }

            #${PANEL_ID} .yt-enhancer-preset:focus {
                border-color: rgba(255, 255, 255, 0.22);
            }

            #${PANEL_ID} .yt-enhancer-preset:disabled {
                opacity: 0.38;
                cursor: not-allowed;
            }

            #${PANEL_ID} .yt-enhancer-slider {
                width: 100%;
                height: 18px;

                margin: 0 0 7px 0;
                padding: 0;

                appearance: none;
                -webkit-appearance: none;

                background: transparent;

                cursor: pointer;

                transition:
                    opacity 0.12s ease;
            }

            #${PANEL_ID} .yt-enhancer-slider:disabled {
                opacity: 0.30;
                cursor: not-allowed;
            }

            #${PANEL_ID} .yt-enhancer-slider::-webkit-slider-runnable-track {
                height: 4px;

                border-radius: 999px;

                background: rgba(255, 255, 255, 0.16);
            }

            #${PANEL_ID} .yt-enhancer-slider::-webkit-slider-thumb {
                appearance: none;
                -webkit-appearance: none;

                width: 13px;
                height: 13px;

                margin-top: -4.5px;

                border: 0;
                border-radius: 50%;

                background: #ffffff;

                box-shadow:
                    0 1px 5px rgba(0, 0, 0, 0.45);
            }

            #${PANEL_ID} .yt-enhancer-slider::-moz-range-track {
                height: 4px;

                border-radius: 999px;

                background: rgba(255, 255, 255, 0.16);
            }

            #${PANEL_ID} .yt-enhancer-slider::-moz-range-thumb {
                width: 13px;
                height: 13px;

                border: 0;
                border-radius: 50%;

                background: #ffffff;

                box-shadow:
                    0 1px 5px rgba(0, 0, 0, 0.45);
            }

            #${PANEL_ID} .yt-enhancer-auto-row {
                display: flex;
                align-items: center;
                justify-content: space-between;

                min-height: 39px;

                margin-top: 1px;
                padding: 0 1px;
            }

            #${PANEL_ID} .yt-enhancer-auto-info {
                min-width: 0;

                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            #${PANEL_ID} .yt-enhancer-auto-title {
                position: relative;

                display: flex;
                align-items: center;

                gap: 6px;

                font-size: 11px;
                font-weight: 600;

                color: rgba(255, 255, 255, 0.92);
            }

            #${PANEL_ID} .yt-enhancer-info {
                position: relative;

                display: inline-flex;
                align-items: center;
                justify-content: center;

                width: 16px;
                height: 16px;

                flex: 0 0 16px;

                box-sizing: border-box;

                border: 1px solid rgba(255, 255, 255, 0.22);
                border-radius: 50%;

                background: rgba(255, 255, 255, 0.10);

                color: rgba(255, 255, 255, 0.90);

                font-size: 10px;
                font-weight: 700;

                line-height: 14px;

                cursor: help;
            }

            #${PANEL_ID} .yt-enhancer-info:hover {
                background: rgba(255, 255, 255, 0.18);
            }

            #${PANEL_ID} .yt-enhancer-tooltip {
                position: absolute;

                left: -2px;
                bottom: 23px;

                width: 170px;

                padding: 7px 8px;

                box-sizing: border-box;

                background: rgba(20, 20, 23, 0.99);

                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 7px;

                color: rgba(255, 255, 255, 0.82);

                font-size: 8px;
                font-weight: 400;

                line-height: 11px;

                white-space: normal;

                text-align: left;

                box-shadow:
                    0 6px 20px rgba(0, 0, 0, 0.48);

                opacity: 0;
                visibility: hidden;

                pointer-events: none;

                transform: translateY(3px);

                transition:
                    opacity 0.10s ease,
                    visibility 0.10s ease,
                    transform 0.10s ease;

                z-index: 100;
            }

            #${PANEL_ID} .yt-enhancer-info:hover .yt-enhancer-tooltip {
                opacity: 1;
                visibility: visible;

                transform: translateY(0);
            }

            #${PANEL_ID} .yt-enhancer-switch {
                position: relative;

                flex: 0 0 auto;

                width: 34px;
                height: 19px;

                margin-left: 8px;
            }

            #${PANEL_ID} .yt-enhancer-switch input {
                position: absolute;

                opacity: 0;

                width: 0;
                height: 0;
            }

            #${PANEL_ID} .yt-enhancer-switch-track {
                position: absolute;

                inset: 0;

                border-radius: 999px;

                background: rgba(255, 255, 255, 0.14);

                cursor: pointer;

                transition:
                    background 0.12s ease;
            }

            #${PANEL_ID} .yt-enhancer-switch-track::after {
                content: "";

                position: absolute;

                top: 3px;
                left: 3px;

                width: 13px;
                height: 13px;

                border-radius: 50%;

                background: rgba(255, 255, 255, 0.78);

                box-shadow:
                    0 1px 3px rgba(0, 0, 0, 0.35);

                transition:
                    transform 0.12s ease;
            }

            #${PANEL_ID} .yt-enhancer-switch input:checked + .yt-enhancer-switch-track {
                background: rgba(255, 255, 255, 0.34);
            }

            #${PANEL_ID} .yt-enhancer-switch input:checked + .yt-enhancer-switch-track::after {
                transform: translateX(15px);

                background: #ffffff;
            }

            #${PANEL_ID} .yt-enhancer-status {
                margin-top: 3px;

                font-size: 8.5px;
                line-height: 12px;

                color: rgba(255, 255, 255, 0.36);

                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;

                letter-spacing: 0.1px;
            }

            @media (prefers-reduced-motion: reduce) {
                #${PANEL_ID},
                #${PANEL_ID} .yt-enhancer-content,
                #${PANEL_ID} .yt-enhancer-info,
                #${PANEL_ID} .yt-enhancer-tooltip,
                #${PANEL_ID} .yt-enhancer-switch-track,
                #${PANEL_ID} .yt-enhancer-switch-track::after {
                    transition: none !important;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /*
     * ------------------------------------------------------------
     * Panel
     * ------------------------------------------------------------
     */

    function createPanel() {
        if (
            document.getElementById(
                PANEL_ID
            )
        ) {
            return;
        }

        createStyles();
        loadNormalPosition();

        panel =
            document.createElement('div');

        panel.id =
            PANEL_ID;

        const handle =
            document.createElement('div');

        handle.className =
            'yt-enhancer-drag-handle';

        handle.textContent =
            '⟡';

        handle.title =
            'Drag to move';

        const content =
            document.createElement('div');

        content.className =
            'yt-enhancer-content';

        const header =
            document.createElement('div');

        header.className =
            'yt-enhancer-header';

        const title =
            document.createElement('div');

        title.className =
            'yt-enhancer-title';

        title.textContent =
            'Video Enhancer';

        const value =
            document.createElement('div');

        value.className =
            'yt-enhancer-value';

        header.appendChild(title);
        header.appendChild(value);

        const preset =
            document.createElement('select');

        preset.className =
            'yt-enhancer-preset';

        const presetOptions = [
            ['custom', 'Custom'],
            ['natural', 'Natural'],
            ['clear', 'Clear'],
            ['strong', 'Strong']
        ];

        for (
            const [
                valueKey,
                label
            ] of presetOptions
        ) {
            const option =
                document.createElement('option');

            option.value =
                valueKey;

            option.textContent =
                label;

            preset.appendChild(option);
        }

        const range =
            document.createElement('input');

        range.type =
            'range';

        range.className =
            'yt-enhancer-slider';

        range.min =
            '0';

        range.max =
            '100';

        range.step =
            '1';

        range.value =
            currentStrength;

        const autoRow =
            document.createElement('div');

        autoRow.className =
            'yt-enhancer-auto-row';

        const autoInfo =
            document.createElement('div');

        autoInfo.className =
            'yt-enhancer-auto-info';

        const autoTitle =
            document.createElement('div');

        autoTitle.className =
            'yt-enhancer-auto-title';

        autoTitle.textContent =
            'Auto Enhance';

        const info =
            document.createElement('span');

        info.className =
            'yt-enhancer-info';

        info.textContent =
            '?';

        const tooltip =
            document.createElement('span');

        tooltip.className =
            'yt-enhancer-tooltip';

        tooltip.textContent =
            'Auto adjusts enhancement by resolution. Lower quality gets stronger enhancement. It does not change YouTube quality.';

        info.appendChild(tooltip);
        autoTitle.appendChild(info);
        autoInfo.appendChild(autoTitle);

        const switchLabel =
            document.createElement('label');

        switchLabel.className =
            'yt-enhancer-switch';

        const checkbox =
            document.createElement('input');

        checkbox.type =
            'checkbox';

        checkbox.checked =
            autoEnhance;

        const switchTrack =
            document.createElement('span');

        switchTrack.className =
            'yt-enhancer-switch-track';

        switchLabel.appendChild(checkbox);
        switchLabel.appendChild(switchTrack);

        autoRow.appendChild(autoInfo);
        autoRow.appendChild(switchLabel);

        const status =
            document.createElement('div');

        status.className =
            'yt-enhancer-status';

        content.appendChild(header);
        content.appendChild(preset);
        content.appendChild(range);
        content.appendChild(autoRow);
        content.appendChild(status);

        panel.appendChild(handle);
        panel.appendChild(content);

        document.body.appendChild(panel);

        slider = range;
        valueLabel = value;
        presetSelect = preset;
        autoCheckbox = checkbox;
        statusLabel = status;

        if (
            ![
                'custom',
                'natural',
                'clear',
                'strong'
            ].includes(currentPreset)
        ) {
            currentPreset =
                'custom';
        }

        if (
            !autoEnhance &&
            currentPreset !== 'custom'
        ) {
            currentStrength =
                getPresetStrength(
                    currentPreset
                );
        }

        slider.value =
            String(currentStrength);

        presetSelect.value =
            currentPreset;

        updateUI();

        /*
         * --------------------------------------------------------
         * Slider
         * --------------------------------------------------------
         */

        slider.addEventListener(
            'input',
            () => {
                if (autoEnhance) {
                    return;
                }

                currentStrength =
                    clamp(
                        Number(
                            slider.value
                        ),
                        0,
                        100
                    );

                currentPreset =
                    'custom';

                presetSelect.value =
                    'custom';

                applyEnhancement(
                    currentVideo ||
                    getVideo()
                );
            }
        );

        slider.addEventListener(
            'change',
            () => {
                if (autoEnhance) {
                    return;
                }

                saveStrength();

                GM_setValue(
                    'ytEnhancerPreset',
                    'custom'
                );
            }
        );

        /*
         * --------------------------------------------------------
         * Presets
         * --------------------------------------------------------
         */

        presetSelect.addEventListener(
            'change',
            () => {
                selectManualMode(
                    presetSelect.value
                );
            }
        );

        /*
         * --------------------------------------------------------
         * Auto
         * --------------------------------------------------------
         */

        autoCheckbox.addEventListener(
            'change',
            () => {
                if (
                    autoCheckbox.checked
                ) {
                    enableAuto();
                } else {
                    autoEnhance =
                        false;

                    GM_setValue(
                        'ytEnhancerAuto',
                        false
                    );

                    slider.disabled =
                        false;

                    presetSelect.disabled =
                        false;

                    updateUI();

                    applyEnhancement(
                        currentVideo ||
                        getVideo()
                    );
                }
            }
        );

        /*
         * --------------------------------------------------------
         * Dragging
         * --------------------------------------------------------
         */

        handle.addEventListener(
            'pointerdown',
            event => {
                if (
                    event.button !== 0 ||
                    document.fullscreenElement
                ) {
                    return;
                }

                event.preventDefault();

                const rect =
                    panel.getBoundingClientRect();

                isDragging =
                    true;

                dragOffsetX =
                    event.clientX -
                    rect.left;

                dragOffsetY =
                    event.clientY -
                    rect.top;

                handle.setPointerCapture?.(
                    event.pointerId
                );

                panel.style.transition =
                    'none';

                /*
                 * While dragging, always use explicit
                 * left/top coordinates.
                 */
                panel.style.width =
                    '46px';

                panel.style.height =
                    '46px';

                panel.style.left =
                    `${rect.left}px`;

                panel.style.top =
                    `${rect.top}px`;

                panel.style.right =
                    'auto';

                panel.style.bottom =
                    'auto';
            }
        );

        handle.addEventListener(
            'pointermove',
            event => {
                if (!isDragging) {
                    return;
                }

                event.preventDefault();

                const panelWidth =
                    panel.offsetWidth;

                const panelHeight =
                    panel.offsetHeight;

                const left =
                    clamp(
                        event.clientX -
                            dragOffsetX,
                        0,
                        Math.max(
                            0,
                            window.innerWidth -
                                panelWidth
                        )
                    );

                const top =
                    clamp(
                        event.clientY -
                            dragOffsetY,
                        0,
                        Math.max(
                            0,
                            window.innerHeight -
                                panelHeight
                        )
                    );

                panel.style.left =
                    `${left}px`;

                panel.style.top =
                    `${top}px`;
            }
        );

        const stopDragging =
            event => {
                if (!isDragging) {
                    return;
                }

                isDragging =
                    false;

                try {
                    handle.releasePointerCapture?.(
                        event.pointerId
                    );
                } catch (_) {}

                panel.style.transition =
                    '';

                panel.style.width =
                    '';

                panel.style.height =
                    '';

                keepInsideScreen();

                /*
                 * This is the important part:
                 * save the position only after the user
                 * actually finishes dragging.
                 */
                saveNormalPosition();
            };

        handle.addEventListener(
            'pointerup',
            stopDragging
        );

        handle.addEventListener(
            'pointercancel',
            stopDragging
        );

        /*
         * Restore the last normal-screen position.
         */
        restoreNormalPosition();
    }

    /*
     * ------------------------------------------------------------
     * Video detection
     * ------------------------------------------------------------
     */

    function handleVideoChange() {
        const video =
            getVideo();

        if (!video) {
            return;
        }

        const resolution =
            getResolution(video);

        const videoChanged =
            video !== currentVideo;

        const resolutionChanged =
            resolution &&
            (
                resolution.width !==
                    lastVideoWidth ||
                resolution.height !==
                    lastVideoHeight
            );

        if (
            videoChanged ||
            resolutionChanged
        ) {
            currentVideo =
                video;

            if (resolution) {
                lastVideoWidth =
                    resolution.width;

                lastVideoHeight =
                    resolution.height;
            } else {
                lastVideoWidth = 0;
                lastVideoHeight = 0;
            }

            setupVideoEvents(video);

            applyEnhancement(video);
        } else {
            updateUI();
        }
    }

    function setupVideoEvents(video) {
        if (
            !video ||
            video.dataset.ytEnhancerEvents === '1'
        ) {
            return;
        }

        video.dataset.ytEnhancerEvents =
            '1';

        video.addEventListener(
            'loadedmetadata',
            () => {
                currentVideo =
                    video;

                const resolution =
                    getResolution(video);

                if (resolution) {
                    lastVideoWidth =
                        resolution.width;

                    lastVideoHeight =
                        resolution.height;
                }

                applyEnhancement(video);
            },
            {
                passive: true
            }
        );

        video.addEventListener(
            'resize',
            () => {
                const resolution =
                    getResolution(video);

                if (!resolution) {
                    return;
                }

                if (
                    resolution.width !==
                        lastVideoWidth ||
                    resolution.height !==
                        lastVideoHeight
                ) {
                    lastVideoWidth =
                        resolution.width;

                    lastVideoHeight =
                        resolution.height;

                    applyEnhancement(video);
                }
            },
            {
                passive: true
            }
        );
    }

    function scanVideo() {
        const video =
            getVideo();

        if (!video) {
            return;
        }

        setupVideoEvents(video);
        handleVideoChange();
    }

    /*
     * ------------------------------------------------------------
     * YouTube navigation
     * ------------------------------------------------------------
     *
     * We no longer use a page-wide MutationObserver.
     *
     * YouTube provides navigation events, and the video element
     * itself provides metadata/resize events.
     */

    function setupYouTubeNavigation() {
        document.addEventListener(
            'yt-navigate-finish',
            () => {
                setTimeout(
                    () => {
                        scanVideo();

                        if (
                            panel &&
                            !document.fullscreenElement
                        ) {
                            restoreNormalPosition();
                        }
                    },
                    100
                );
            },
            {
                passive: true
            }
        );

        /*
         * YouTube can update its player without a normal
         * navigation. This event is cheap and useful when
         * available.
         */
        document.addEventListener(
            'yt-player-updated',
            () => {
                scanVideo();
            },
            {
                passive: true
            }
        );
    }

    /*
     * ------------------------------------------------------------
     * Fullscreen
     * ------------------------------------------------------------
     *
     * No polling.
     *
     * The browser tells us when fullscreen changes.
     */

    function handleFullscreenChange() {
        if (!panel) {
            return;
        }

        if (document.fullscreenElement) {
            /*
             * IMPORTANT:
             *
             * Capture the position BEFORE hiding the panel.
             * We do not call keepInsideScreen() here because the
             * fullscreen viewport may have completely different
             * dimensions.
             */
            const position =
                getPanelPosition();

            if (position) {
                normalPosition =
                    position;

                GM_setValue(
                    'ytEnhancerPosition',
                    position
                );
            }

            /*
             * Hide the enhancer during fullscreen.
             */
            panel.style.display =
                'none';

            return;
        }

        /*
         * Fullscreen ended.
         *
         * Show the panel and restore the exact position it had
         * before fullscreen.
         */
        panel.style.display =
            '';

        if (restorePositionTimer) {
            clearTimeout(
                restorePositionTimer
            );
        }

        /*
         * A small delay allows YouTube/browser to finish its
         * fullscreen layout transition.
         */
        restorePositionTimer =
            setTimeout(
                () => {
                    restorePositionTimer =
                        null;

                    restoreNormalPosition();
                },
                80
            );
    }

    /*
     * ------------------------------------------------------------
     * Window resize
     * ------------------------------------------------------------
     *
     * IMPORTANT:
     *
     * We do NOT save the position on every resize anymore.
     *
     * Previously a fullscreen/window resize could overwrite the
     * position that should have been restored later.
     */

    function setupResizeHandler() {
        window.addEventListener(
            'resize',
            () => {
                if (
                    document.fullscreenElement ||
                    !panel
                ) {
                    return;
                }

                keepInsideScreen();
            },
            {
                passive: true
            }
        );
    }

    /*
     * ------------------------------------------------------------
     * Initialization
     * ------------------------------------------------------------
     */

    function initialize() {
        createPanel();

        document.addEventListener(
            'fullscreenchange',
            handleFullscreenChange,
            {
                passive: true
            }
        );

        setupYouTubeNavigation();
        setupResizeHandler();

        /*
         * Initial video detection.
         *
         * These are only a few startup checks, not a permanent
         * polling loop.
         */
        scanVideo();

        setTimeout(
            scanVideo,
            500
        );

        setTimeout(
            scanVideo,
            1500
        );

        setTimeout(
            scanVideo,
            3000
        );
    }

    /*
     * ------------------------------------------------------------
     * Start
     * ------------------------------------------------------------
     */

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }

})();