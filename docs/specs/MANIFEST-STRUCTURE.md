# Fabric Workload Manifest Structure

This document defines the manifest package structure for Microsoft Fabric workloads. The structure is critical - Fabric DevGateway will reject packages that don't follow this exact format.

## Source Structure

```
src/Workload/Manifest/
├── WorkloadManifest.xml       # Backend workload definition
├── Product.json               # Frontend product metadata
├── ManifestPackage.nuspec     # NuGet package specification (template)
├── assets/
│   └── images/                # Icons and images (referenced in JSON)
│       ├── Workload_Icon.png
│       ├── DQCheckerItem_Icon.png
│       └── Workload_Hub_*.png
└── items/                     # Item-specific files (per item type)
    └── {ItemName}Item/        # e.g., DQCheckerItem
        ├── {ItemName}Item.xml     # Backend item definition
        └── {ItemName}Item.json    # Frontend item manifest
```

## Built Package Structure (nupkg)

After build, the NuGet package has this structure:

```
{WorkloadName}.{Version}.nupkg
├── BE/                        # Backend definitions (XML only)
│   ├── WorkloadManifest.xml
│   └── DQCheckerItem.xml      # Item XMLs moved to root
├── FE/                        # Frontend definitions (JSON + assets)
│   ├── Product.json
│   ├── DQCheckerItem.json     # Item JSONs moved to root
│   └── assets/
│       └── images/
└── [package metadata]
```

## File Types by Folder

| Folder | Allowed Types | Purpose |
|--------|---------------|---------|
| `BE/` | `.xml` only | Backend workload and item definitions |
| `FE/` | `.json`, images | Frontend product and item manifests |

**Critical:** Placing JSON files in `BE/` or XML files in `FE/` will cause registration failure.

## File Specifications

### WorkloadManifest.xml (Backend Workload Definition)

```xml
<?xml version="1.0" encoding="utf-8"?>
<WorkloadManifest xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  SchemaVersion="2.0.0">
  <Workload Name="{{WORKLOAD_NAME}}">
    <DisplayName>{{WORKLOAD_DISPLAY_NAME}}</DisplayName>
    <SupportedRegions>
      <Region>WestUS2</Region>
      <Region>WestUS3</Region>
      <Region>EastUS</Region>
      <Region>WestCentralUS</Region>
    </SupportedRegions>
    <HostingEnvironments>
      <Environment Type="FERemote">
        <Urls>
          <Url>http://localhost:60006/</Url>
        </Urls>
      </Environment>
    </HostingEnvironments>
    <AADApp AppId="{{AZURE_CLIENT_ID}}" RedirectUri="{{REDIRECT_URI}}" />
  </Workload>
</WorkloadManifest>
```

### Item XML (Backend Item Definition)

```xml
<?xml version="1.0" encoding="utf-8"?>
<ItemManifestConfiguration SchemaVersion="2.0.0">
  <Item TypeName="{{WORKLOAD_NAME}}.{{ITEM_NAME}}" Category="Data">
    <Workload WorkloadName="{{WORKLOAD_NAME}}" />
  </Item>
</ItemManifestConfiguration>
```

**Common Mistakes:**
- ❌ `<ItemDefinitionConfiguration>` - Wrong root element
- ✅ `<ItemManifestConfiguration>` - Correct root element

### Product.json (Frontend Product Metadata)

```json
{
    "name": "Product",
    "version": "1.100",
    "displayName": "Workload_Display_Name",
    "fullDisplayName": "Workload_Full_Display_Name",
    "description": "Workload_Description",
    "favicon": "assets/images/Workload_Icon.png",
    "icon": {
      "name": "assets/images/Workload_Icon.png"
    },
    "homePage": {
      "learningMaterials": [
        {
          "title": "Workload_Hub_GetStarted_1_Title",
          "introduction": "Workload_Hub_GetStarted_1_Sub_Title",
          "description": "Workload_Hub_GetStarted_1_Description",
          "image": "assets/images/Workload_Hub_GetStarted_1.png",
          "link": "https://github.com/your-org/project"
        }
      ],
      "newSection": {
        "customActions": []
      },
      "recommendedItemTypes": ["DQChecker"]
    },
    "createExperience": {
      "description": "Workload_Description",
      "cards": [
        {
          "title": "DQCheckerItem_DisplayName",
          "description": "DQCheckerItem_Description",
          "icon": { "name": "assets/images/DQCheckerItem_Icon.png" },
          "icon_small": { "name": "assets/images/DQCheckerItem_Icon.png" },
          "availableIn": ["home", "create-hub", "workspace-plus-new", "workspace-plus-new-teams"],
          "itemType": "DQChecker",
          "createItemDialogConfig": {
            "onCreationFailure": { "action": "item.onCreationFailure" },
            "onCreationSuccess": { "action": "item.onCreationSuccess" }
          }
        }
      ]
    },
    "productDetail": {
      "publisher": "Your Name",
      "slogan": "Workload_Hub_Slogan",
      "description": "Workload_Hub_Description",
      "image": { "mediaType": 0, "source": "assets/images/Workload_Hub_Banner.png" },
      "slideMedia": [
        { "mediaType": 0, "source": "assets/images/Workload_Hub_SlideMedia_1.png" }
      ],
      "supportLink": {
        "documentation": { "url": "https://github.com/your-org/project" },
        "certification": { "url": "https://github.com/your-org/project" },
        "help": { "url": "https://github.com/your-org/project" },
        "privacy": { "url": "https://github.com/your-org/project" },
        "terms": { "url": "https://github.com/your-org/project" },
        "license": { "url": "https://github.com/your-org/project" }
      }
    },
    "itemJobTypes": ["storeData", "others"],
    "compatibleItemTypes": ["Warehouse", "SQLDatabase"]
}
```

### Item JSON (Frontend Item Manifest)

**IMPORTANT:** Use the new format from the [Fabric Extensibility Toolkit](https://github.com/microsoft/fabric-extensibility-toolkit). The old `handler.type: "iframehandler"` format causes routing issues.

```json
{
    "name": "DQChecker",
    "version": "1.100",
    "displayName": "DQCheckerItem_DisplayName",
    "displayNamePlural": "DQCheckerItem_DisplayName_Plural",
    "description": "DQCheckerItem_Description",
    "shortDescription": "DQCheckerItem_Description",
    "editor": {
        "path": "/DQCheckerItem-editor"
    },
    "icon": { "name": "assets/images/DQCheckerItem_Icon.png" },
    "activeIcon": { "name": "assets/images/DQCheckerItem_Icon.png" },
    "contextMenuItems": [],
    "quickActionItems": [],
    "supportedInMonitoringHub": true,
    "supportedInDatahubL1": true,
    "itemJobActionConfig": {},
    "editorTab": {
        "onDeactivate": "item.tab.onDeactivate",
        "canDeactivate": "item.tab.canDeactivate",
        "canDestroy": "item.tab.canDestroy",
        "onDestroy": "item.tab.onDestroy",
        "onDelete": "item.tab.onDelete"
    },
    "createItemDialogConfig": {
        "onCreationFailure": { "action": "item.onCreationFailure" },
        "onCreationSuccess": { "action": "item.onCreationSuccess" }
    }
}
```

**Key differences from old format:**
- ❌ `handler.type: "iframehandler"` - Old format, causes routing issues
- ✅ `editor.path` - Direct property at root level
- ❌ `editor.path: "/.../:itemObjectId"` - Don't include parameter
- ✅ `editor.path: "/DQCheckerItem-editor"` - Fabric appends itemObjectId automatically
- ✅ `editorTab` - Tab lifecycle events (required for proper cleanup)
- ✅ `createItemDialogConfig` - Creation success/failure handlers

## Common Validation Errors

### URL Validation

All URLs in `Product.json` MUST be valid HTTPS URLs.

| Field | Invalid | Valid |
|-------|---------|-------|
| `learningMaterials[].link` | `"#"` | `"https://github.com/org/repo"` |
| `supportLink.*.url` | `""` | `"https://docs.example.com"` |

**Error:** `The URL must be a valid HTTPS URL`

### Asset Validation

All images referenced in JSON files must exist in `assets/images/`.

**Error:** `The following image is not referenced by any item: DataLineageItem_Icon.png`

**Fix:** Remove unreferenced images from `assets/images/` folder.

### XML Root Element

Item XML files MUST use `ItemManifestConfiguration` as the root element.

**Error:** `Cannot deserialize XML: The 'ItemDefinitionConfiguration' element is not declared`

**Fix:** Change root element from `<ItemDefinitionConfiguration>` to `<ItemManifestConfiguration>`.

### File Type Placement

Backend (BE/) folder only accepts XML files.

**Error:** `Folder contains invalid file types. Invalid files: 'DQCheckerItem.json'`

**Fix:** Update nuspec to place JSON files in `FE/` folder, not `BE/`.

### Version Format

The `version` field in Product.json uses Fabric schema version, not SemVer.

| Invalid | Valid |
|---------|-------|
| `"1.3.0"` | `"1.100"` |
| `"v1.0"` | `"1.100"` |

## Build Process

The build script (`scripts/Build/BuildManifestPackage.ps1`):

1. Copies all files from `src/Workload/Manifest/` to temp directory
2. Moves item files from `items/{ItemName}/` subdirectories to root
3. Replaces `{{PLACEHOLDER}}` variables with values from `.env.dev`
4. Builds NuGet package with correct BE/FE folder structure
5. Creates `build/DevGateway/workload-dev-mode.json` pointing to built package

### Environment Variables (.env.dev)

Required variables for manifest build:

```
WORKLOAD_NAME=Org.DQChecker
WORKLOAD_VERSION=1.0.0
WORKLOAD_DISPLAY_NAME=DQ Checker
AZURE_CLIENT_ID=<app-registration-client-id>
REDIRECT_URI=http://localhost:60006/close
ITEM_NAMES=DQChecker
```

### Build Command

```powershell
cd scripts\Build
.\BuildManifestPackage.ps1
```

Output: `build/Manifest/{WORKLOAD_NAME}.{WORKLOAD_VERSION}.nupkg`

## Item Registration Requirements

For items to appear in Fabric UI:

1. **Backend XML** - Item must be defined in `items/{ItemName}Item/{ItemName}Item.xml`
2. **Frontend JSON** - Item must be defined in `items/{ItemName}Item/{ItemName}Item.json`
3. **Product.json** - Item must appear in BOTH:
   - `createExperience.cards[]` - for "New" dialog
   - `homePage.recommendedItemTypes[]` - for workspace home
4. **Icons** - Referenced icons must exist in `assets/images/`

## DevGateway Registration

After successful build:

```powershell
# Start DevGateway (reads workload-dev-mode.json)
.\scripts\Run\StartDevGateway.ps1

# Expected output:
# [info] Loading configuration from: ...\workload-dev-mode.json
# [info] Loading manifest: ...\Org.DQChecker.1.0.0.nupkg
# [info] Dev instance registered successfully
# [info] DevGateway started
```

If registration fails, check:
1. All URLs are valid HTTPS (not `#` or empty)
2. All referenced images exist
3. XML uses correct root element (`ItemManifestConfiguration`)
4. JSON files are in `FE/` not `BE/`
5. Version format is correct (`1.100` not `1.0.0`)

## References

- [Fabric Workload Manifest](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/manifest-workload)
- [Fabric Item Manifest](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/manifest-item)
- [Extensibility Toolkit Overview](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/extensibility-toolkit-overview)
