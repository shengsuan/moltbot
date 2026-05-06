# OpenClaw Installer for Windows (PowerShell)
# Usage: iwr -useb https://openclaw.ai/install.ps1 | iex
# Or: & ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -NoOnboard

param(
    [ValidateSet("npm", "git")]
    [string]$InstallMethod = "npm",
    [string]$Tag = "latest",
    [string]$GitDir = "$env:USERPROFILE\openclaw",
    [switch]$NoOnboard,
    [switch]$NoGitUpdate,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Colors
$ACCENT = "`e[38;2;255;77;77m"    # coral-bright
$SUCCESS = "`e[38;2;0;229;204m"    # cyan-bright
$WARN = "`e[38;2;255;176;32m"     # amber
$ERROR_COLOR = "`e[38;2;230;57;70m"     # coral-mid
$MUTED = "`e[38;2;90;100;128m"    # text-muted
$NC = "`e[0m"                     # No Color

function Write-Host {
    param([string]$Message, [string]$Level = "info")
    $msg = switch ($Level) {
        "success" { "$SUCCESS✓$NC $Message" }
        "warn" { "$WARN!$NC $Message" }
        "error" { "$ERROR_COLOR✗$NC $Message" }
        default { "$MUTED·$NC $Message" }
    }
    Microsoft.PowerShell.Utility\Write-Host $msg
}

function Write-Banner {
    Write-Host ""
    Write-Host "${ACCENT}  🦞 OpenClaw 安装程序$NC" -Level info
    Write-Host "${MUTED}  您的所有聊天，一个 OpenClaw。$NC" -Level info
    Write-Host ""
}

function Get-ExecutionPolicyStatus {
    $policy = Get-ExecutionPolicy
    if ($policy -eq "Restricted" -or $policy -eq "AllSigned") {
        return @{ Blocked = $true; Policy = $policy }
    }
    return @{ Blocked = $false; Policy = $policy }
}

function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-ExecutionPolicy {
    $status = Get-ExecutionPolicyStatus
    if ($status.Blocked) {
        Write-Host "PowerShell 执行策略设置为：$($status.Policy)" -Level warn
        Write-Host "这会阻止像 npm.ps1 这样的脚本运行。" -Level warn
        Write-Host ""
        
        # Try to set execution policy for current process
        try {
            Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -ErrorAction Stop
            Write-Host "为当前进程设置执行策略为 RemoteSigned" -Level success
            return $true
        } catch {
            Write-Host "无法自动设置执行策略" -Level error
            Write-Host ""
            Write-Host "要修复此问题，请运行：" -Level info
            Write-Host "  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process" -Level info
            Write-Host ""
            Write-Host "或以管理员身份运行 PowerShell 并执行：" -Level info
            Write-Host "  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine" -Level info
            return $false
        }
    }
    return $true
}

function Get-NodeVersion {
    try {
        $version = node --version 2>$null
        if ($version) {
            return $version -replace '^v', ''
        }
    } catch { }
    return $null
}

function Get-NpmVersion {
    try {
        $version = npm --version 2>$null
        if ($version) {
            return $version
        }
    } catch { }
    return $null
}

function Install-Node {
    Write-Host "未找到 Node.js" -Level info
    Write-Host "正在安装 Node.js..." -Level info
    
    # Try winget first
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "  使用 winget..." -Level info
        try {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Host "  已通过 winget 安装 Node.js" -Level success
            return $true
        } catch {
            Write-Host "  Winget 安装失败：$_" -Level warn
        }
    }
    
    # Try chocolatey
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Host "  使用 chocolatey..." -Level info
        try {
            choco install nodejs-lts -y 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Host "  已通过 chocolatey 安装 Node.js" -Level success
            return $true
        } catch {
            Write-Host "  Chocolatey 安装失败：$_" -Level warn
        }
    }
    
    # Try scoop
    if (Get-Command scoop -ErrorAction SilentlyContinue) {
        Write-Host "  使用 scoop..." -Level info
        try {
            scoop install nodejs-lts 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Host "  已通过 scoop 安装 Node.js" -Level success
            return $true
        } catch {
            Write-Host "  Scoop 安装失败：$_" -Level warn
        }
    }
    
    Write-Host "无法自动安装 Node.js" -Level error
    Write-Host "请从以下位置手动安装 Node.js 22+：https://nodejs.org" -Level info
    return $false
}

function Ensure-Node {
    $nodeVersion = Get-NodeVersion
    if ($nodeVersion) {
        $major = [int]($nodeVersion -split '\.')[0]
        if ($major -ge 22) {
            Write-Host "找到 Node.js v$nodeVersion" -Level success
            return $true
        }
        Write-Host "找到 Node.js v$nodeVersion，但需要 v22+" -Level warn
    }
    return Install-Node
}

function Get-GitVersion {
    try {
        $version = git --version 2>$null
        if ($version) {
            return $version
        }
    } catch { }
    return $null
}

function Install-Git {
    Write-Host "未找到 Git" -Level info
    
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "  正在通过 winget 安装 Git..." -Level info
        try {
            winget install Git.Git --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Host "  Git 已安装" -Level success
            return $true
        } catch {
            Write-Host "  Winget 安装失败" -Level warn
        }
    }
    
    Write-Host "请从以下位置安装 Git for Windows：https://git-scm.com" -Level error
    return $false
}

function Ensure-Git {
    $gitVersion = Get-GitVersion
    if ($gitVersion) {
        Write-Host "$gitVersion 已找到" -Level success
        return $true
    }
    return Install-Git
}

function Read-TrimmedFileText {
    param([string]$Path)

    if (!(Test-Path -LiteralPath $Path)) {
        return ""
    }

    return ((Get-Content -LiteralPath $Path -Raw) -replace "(\r?\n)+$", "")
}

function ConvertTo-PowerShellSingleQuotedLiteral {
    param([string]$Value)

    return "'" + ($Value -replace "'", "''") + "'"
}

function Invoke-NativeCommandCapture {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = ""
    )

    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()

    try {
        $startFilePath = $FilePath
        $startArguments = $Arguments

        if ($FilePath -match '(?i)\.(cmd|bat)$') {
            # Start-Process cannot directly redirect stdio for command shims like
            # npm.cmd. Run them inside a nested PowerShell so the shim executes
            # normally while stdout/stderr still flow back to these temp files.
            $commandParts = @(
                ConvertTo-PowerShellSingleQuotedLiteral -Value $FilePath
            )
            foreach ($argument in $Arguments) {
                $commandParts += ConvertTo-PowerShellSingleQuotedLiteral -Value $argument
            }
            $commandScript = "& " + ($commandParts -join " ") + "`nexit `$LASTEXITCODE"
            $startFilePath = "powershell.exe"
            $startArguments = @(
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                $commandScript
            )
        }

        $startProcessArgs = @{
            FilePath = $startFilePath
            ArgumentList = $startArguments
            Wait = $true
            PassThru = $true
            RedirectStandardOutput = $stdoutPath
            RedirectStandardError = $stderrPath
        }
        if (![string]::IsNullOrWhiteSpace($WorkingDirectory)) {
            $startProcessArgs.WorkingDirectory = $WorkingDirectory
        }

        $process = Start-Process @startProcessArgs

        return @{
            ExitCode = $process.ExitCode
            Stdout = Read-TrimmedFileText -Path $stdoutPath
            Stderr = Read-TrimmedFileText -Path $stderrPath
        }
    } finally {
        Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-NpmWorkingDirectory {
    $workingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "openclaw-installer"
    New-Item -ItemType Directory -Path $workingDirectory -Force | Out-Null
    return $workingDirectory
}

function Install-OpenClawNpm {
    param([string]$Version = "latest")
    
    Write-Host "正在安装 OpenClaw (openclaw@$Version)..." -Level info
    
    try {
        # Run npm out-of-process so warning chatter on stderr does not get
        # promoted into a terminating PowerShell error while the install succeeds.
        $installResult = Invoke-NativeCommandCapture -FilePath "npm.cmd" -Arguments @(
            "install",
            "-g",
            $installSpec,
            "--no-fund",
            "--no-audit"
        ) -WorkingDirectory (Get-NpmWorkingDirectory)
        if ($installResult.Stdout) {
            Microsoft.PowerShell.Utility\Write-Host $installResult.Stdout
        }
        if ($installResult.Stderr) {
            Microsoft.PowerShell.Utility\Write-Host $installResult.Stderr
        }
        if ($installResult.ExitCode -ne 0) {
            Write-Host "npm install failed with exit code $($installResult.ExitCode)" -Level error
            return $false
        }
        Write-Host "OpenClaw installed" -Level success
        return $true
    } catch {
        Write-Host "npm 安装失败：$_" -Level error
        return $false
    }
}

function Install-OpenClawGit {
    param([string]$RepoDir, [switch]$Update)
    
    Write-Host "正在从 git 安装 OpenClaw..." -Level info
    
    if (!(Test-Path $RepoDir)) {
        Write-Host "  正在克隆仓库..." -Level info
        git clone https://github.com/openclaw/openclaw.git $RepoDir 2>&1
    } elseif ($Update) {
        Write-Host "  正在更新仓库..." -Level info
        git -C $RepoDir pull --rebase 2>&1
    }
    
    # Install pnpm if not present
    if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Host "  正在安装 pnpm..." -Level info
        npm install -g pnpm 2>&1
    }
    
    # Install dependencies
    Write-Host "  正在安装依赖..." -Level info
    pnpm install --dir $RepoDir 2>&1
    
    # Build
    Write-Host "  正在构建..." -Level info
    pnpm --dir $RepoDir build 2>&1
    
    # Create wrapper
    $wrapperDir = "$env:USERPROFILE\.local\bin"
    if (!(Test-Path $wrapperDir)) {
        New-Item -ItemType Directory -Path $wrapperDir -Force | Out-Null
    }

    $entryPath = Join-Path $RepoDir "dist\entry.js"
    @"
@echo off
node "$entryPath" %*
"@ | Out-File -FilePath "$wrapperDir\openclaw.cmd" -Encoding ASCII -Force
    Add-ToPath -Path $wrapperDir
    
    Write-Host "OpenClaw 已安装" -Level success
    return $true
}

function Add-ToPath {
    param([string]$Path)
    
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$Path*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$Path", "User")
        Write-Host "已将 $Path 添加到用户 PATH" -Level info
    }
}

$script:InstallExitCode = 0

function Fail-Install {
    param([int]$Code = 1)

    $script:InstallExitCode = $Code
    return $false
}

function Complete-Install {
    param([bool]$Succeeded)

    if ($Succeeded) {
        return
    }

    if ($PSCommandPath) {
        exit $script:InstallExitCode
    }

    throw "OpenClaw installation failed with exit code $($script:InstallExitCode)."
}

# Main
function Main {
    Write-Banner
    
    Write-Host "检测到 Windows" -Level success
    
    # Check and handle execution policy FIRST, before any npm calls
    if (!(Ensure-ExecutionPolicy)) {
        Write-Host ""
        Write-Host "Installation cannot continue due to execution policy restrictions" -Level error
        return (Fail-Install)
    }
    
    if (!(Ensure-Node)) {
        return (Fail-Install)
    }
    
    if ($InstallMethod -eq "git") {
        if (!(Ensure-Git)) {
            return (Fail-Install)
        }
        
        if ($DryRun) {
            Write-Host "[DRY RUN] 将从 git 安装 OpenClaw 到 $GitDir" -Level info
        } else {
            try {
                npm uninstall -g openclaw 2>$null | Out-Null
            } catch { }
            if (!(Install-OpenClawGit -RepoDir $GitDir -Update:(-not $NoGitUpdate))) {
                return (Fail-Install)
            }
        }
    } else {
        # npm method
        if (!(Ensure-Git)) {
            Write-Host "npm 安装需要 Git。请安装 Git 并重试。" -Level warn
        }
        
        if ($DryRun) {
            Write-Host "[DRY RUN] 将通过 npm 安装 OpenClaw (标签：$Tag)" -Level info
        } else {
            $gitWrapper = "$env:USERPROFILE\.local\bin\openclaw.cmd"
            if (Test-Path $gitWrapper) {
                Remove-Item -Force $gitWrapper
                Write-Host "Removed git wrapper (switching to npm)" -Level info
            }
            if (!(Install-OpenClawNpm -Target $Tag)) {
                return (Fail-Install)
            }
        }
    }
    
    # Try to add npm global bin to PATH
    try {
        $prefixResult = Invoke-NativeCommandCapture -FilePath "npm.cmd" -Arguments @(
            "config",
            "get",
            "prefix"
        ) -WorkingDirectory (Get-NpmWorkingDirectory)
        $npmPrefix = $prefixResult.Stdout
        if ($prefixResult.ExitCode -eq 0 -and $npmPrefix) {
            Add-ToPath -Path "$npmPrefix"
        }
    } catch { }
    
    if (!$NoOnboard -and !$DryRun) {
        Write-Host ""
        Write-Host "运行 'openclaw onboard' 完成设置" -Level info
    }
    
    Write-Host ""
    Write-Host "🦞 OpenClaw installed successfully!" -Level success
    return $true
}

$mainResults = @(Main)
$installSucceeded = $mainResults.Count -gt 0 -and $mainResults[-1] -eq $true
Complete-Install -Succeeded:$installSucceeded
