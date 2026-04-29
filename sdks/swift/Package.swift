// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Locksmith",
    platforms: [
        .macOS(.v13),
        .iOS(.v16),
        .tvOS(.v16),
        .watchOS(.v9),
    ],
    products: [
        .library(name: "Locksmith", targets: ["Locksmith"]),
    ],
    targets: [
        .target(
            name: "Locksmith",
            dependencies: [],
            path: "Sources/Locksmith"
        ),
    ]
)
