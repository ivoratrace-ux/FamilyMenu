import SwiftUI
import UIKit
import FamilyMenu

@main
struct FamilyMenuApp: App {
    var body: some Scene { WindowGroup { FamilyMenuView().ignoresSafeArea() } }
}
struct FamilyMenuView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.MainViewController()
    }
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
