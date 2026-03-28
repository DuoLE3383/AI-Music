# Root folders
$folders = @(
    "src/components/transport",
    "src/components/sidebar",
    "src/components/editor",
    "src/components/common",
    "src/hooks",
    "src/services",
    "src/styles"
)

# Create folders
foreach ($folder in $folders) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
}

# Files to create
$files = @(
    "src/App.jsx",

    "src/components/transport/TransportBar.jsx",
    "src/components/transport/TransportBar.css",

    "src/components/sidebar/SidebarControls.jsx",
    "src/components/sidebar/SidebarControls.css",

    "src/components/editor/PianoEditor.jsx",
    "src/components/editor/PianoEditor.css",

    "src/components/common/StatusBadge.jsx",
    "src/components/common/Loader.jsx",

    "src/hooks/useAudioPlayer.js",
    "src/hooks/useAIEngine.js",
    "src/hooks/useSequence.js",

    "src/services/api.js",

    "src/styles/layout.css",
    "src/styles/variables.css"
)

# Create files
foreach ($file in $files) {
    if (!(Test-Path $file)) {
        New-Item -ItemType File -Path $file | Out-Null
    }
}

Write-Host "✅ Project structure created successfully!"
