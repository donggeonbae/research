param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,

    [string]$Template = "",

    [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

if ([string]::IsNullOrWhiteSpace($Template)) {
    $Template = Join-Path $repoRoot "AGENTS.md"
}

$resolvedProjectPath = Resolve-Path -LiteralPath $ProjectPath
$resolvedTemplate = Resolve-Path -LiteralPath $Template
$destination = Join-Path $resolvedProjectPath "AGENTS.md"

if ((Test-Path -LiteralPath $destination) -and -not $Force) {
    throw "AGENTS.md already exists at '$destination'. Use -Force to overwrite it."
}

Copy-Item -LiteralPath $resolvedTemplate -Destination $destination -Force:$Force

Write-Host "Installed AGENTS.md to $destination"
