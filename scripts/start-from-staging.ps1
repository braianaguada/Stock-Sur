param(
    [Parameter(Mandatory = $true)]
    [string]$BranchName
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    & git @Args
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$status = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$blockingStatus = $status | Where-Object { $_ -notlike "?? scripts*" }

if ($blockingStatus) {
    Write-Error "Hay cambios sin guardar. Hace commit o stash antes de crear una rama nueva desde staging."
}

$existingLocal = git branch --list $BranchName
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

if ($existingLocal) {
    Write-Error "La rama '$BranchName' ya existe localmente."
}

$existingRemote = git ls-remote --heads origin $BranchName
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

if ($existingRemote) {
    Write-Error "La rama '$BranchName' ya existe en origin."
}

Invoke-Git -Args @("fetch", "origin", "--prune")
Invoke-Git -Args @("switch", "staging")
Invoke-Git -Args @("pull", "--ff-only", "origin", "staging")
Invoke-Git -Args @("switch", "-c", $BranchName)

Write-Host ""
Write-Host "Rama creada desde staging: $BranchName"
Write-Host "Siguiente paso sugerido: git push -u origin $BranchName"
