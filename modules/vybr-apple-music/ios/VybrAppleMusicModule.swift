/**
 * Vybr Apple Music Module - iOS Implementation
 *
 * This module provides native Swift integration with Apple Music via MusicKit.
 * It handles authorization and fetches user music data including:
 * - Recently played tracks
 * - Heavy rotation items
 * - Catalog data (for genres)
 *
 * The module uses the Apple Music REST API via MusicDataRequest for
 * authenticated requests to the user's personal music data.
 */

import ExpoModulesCore
import MusicKit
import Foundation

// ========================================
// = OLD IMPLEMENTATION (COMMENTED OUT)
// ========================================
/*
public class VybrAppleMusicModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VybrAppleMusic")

    AsyncFunction("authorize") { (promise: Promise) in
      if #available(iOS 15.0, *) {
        Task {
          let status = await MusicAuthorization.request()
          switch status {
          case .authorized:
            promise.resolve("authorized")
          case .denied:
            promise.resolve("denied")
          case .notDetermined:
            promise.resolve("notDetermined")
          case .restricted:
            promise.resolve("restricted")
          @unknown default:
            promise.resolve("unknown")
          }
        }
      } else {
        promise.reject("ERR_OS_VERSION", "iOS 15.0 or higher is required for MusicKit")
      }
    }

    AsyncFunction("getHeavyRotation") { (limit: Int?, promise: Promise) in
      if #available(iOS 15.0, *) {
        Task {
          do {
            let status = await MusicAuthorization.request()
            guard status == .authorized else {
              promise.reject("ERR_AUTH", "Not authorized")
              return
            }
            
            let url = URL(string: "https://api.music.apple.com/v1/me/history/heavy-rotation")!
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "limit", value: String(limit ?? 20))]
            
            guard let requestUrl = components.url else {
                 promise.reject("ERR_URL", "Invalid URL")
                 return
            }

            let request = MusicDataRequest(urlRequest: URLRequest(url: requestUrl))
            let response = try await request.response()
            
            let json = try JSONSerialization.jsonObject(with: response.data, options: [])
            promise.resolve(json)
          } catch {
            promise.reject("ERR_MUSIC_KIT", error.localizedDescription)
          }
        }
      } else {
        promise.reject("ERR_OS_VERSION", "iOS 15.0 or higher is required for MusicKit")
      }
    }
    
    AsyncFunction("getRecentlyPlayed") { (limit: Int?, promise: Promise) in
      if #available(iOS 15.0, *) {
        Task {
          do {
            let status = await MusicAuthorization.request()
            guard status == .authorized else {
              promise.reject("ERR_AUTH", "Not authorized")
              return
            }

            let url = URL(string: "https://api.music.apple.com/v1/me/recent/played/tracks")!
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "limit", value: String(limit ?? 20))]
            
            guard let requestUrl = components.url else {
                 promise.reject("ERR_URL", "Invalid URL")
                 return
            }

            let request = MusicDataRequest(urlRequest: URLRequest(url: requestUrl))
            let response = try await request.response()
            
            let json = try JSONSerialization.jsonObject(with: response.data, options: [])
            promise.resolve(json)
          } catch {
            promise.reject("ERR_MUSIC_KIT", error.localizedDescription)
          }
        }
      } else {
        promise.reject("ERR_OS_VERSION", "iOS 15.0 or higher is required for MusicKit")
      }
    }
  }
}
*/
// ========================================
// = END OF OLD IMPLEMENTATION
// ========================================

// ========================================
// = NEW UNIFIED IMPLEMENTATION
// ========================================

public class VybrAppleMusicModule: Module {
  
  // User's storefront (e.g., "us", "gb", etc.)
  private var userStorefront: String = "us"
  
  public func definition() -> ModuleDefinition {
    Name("VybrAppleMusic")

    // --- Authorization ---
    AsyncFunction("authorize") { (promise: Promise) in
      if #available(iOS 15.0, *) {
        Task {
          let status = await MusicAuthorization.request()
          switch status {
          case .authorized:
            // Get user's storefront after authorization
            await self.fetchUserStorefront()
            promise.resolve("authorized")
          case .denied:
            promise.resolve("denied")
          case .notDetermined:
            promise.resolve("notDetermined")
          case .restricted:
            promise.resolve("restricted")
          @unknown default:
            promise.resolve("unknown")
          }
        }
      } else {
        promise.reject("ERR_OS_VERSION", "iOS 15.0 or higher is required for MusicKit")
      }
    }

    // --- Get Heavy Rotation ---
    AsyncFunction("getHeavyRotation") { (limit: Int?, promise: Promise) in
      if #available(iOS 15.0, *) {
        Task {
          do {
            let status = await MusicAuthorization.request()
            guard status == .authorized else {
              promise.reject("ERR_AUTH", "Not authorized")
              return
            }
            
            let url = URL(string: "https://api.music.apple.com/v1/me/history/heavy-rotation")!
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "limit", value: String(limit ?? 20))]
            
            guard let requestUrl = components.url else {
              promise.reject("ERR_URL", "Invalid URL")
              return
            }

            let request = MusicDataRequest(urlRequest: URLRequest(url: requestUrl))
            let response = try await request.response()
            
            let json = try JSONSerialization.jsonObject(with: response.data, options: [])
            promise.resolve(json)
          } catch {
            promise.reject("ERR_MUSIC_KIT", error.localizedDescription)
          }
        }
      } else {
        promise.reject("ERR_OS_VERSION", "iOS 15.0 or higher is required for MusicKit")
      }
    }
    
    // --- Get Recently Played Tracks ---
    AsyncFunction("getRecentlyPlayed") { (limit: Int?, promise: Promise) in
      if #available(iOS 15.0, *) {
        Task {
          do {
            let status = await MusicAuthorization.request()
            guard status == .authorized else {
              promise.reject("ERR_AUTH", "Not authorized")
              return
            }

            let url = URL(string: "https://api.music.apple.com/v1/me/recent/played/tracks")!
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "limit", value: String(limit ?? 20))]
            
            guard let requestUrl = components.url else {
              promise.reject("ERR_URL", "Invalid URL")
              return
            }

            let request = MusicDataRequest(urlRequest: URLRequest(url: requestUrl))
            let response = try await request.response()
            
            let json = try JSONSerialization.jsonObject(with: response.data, options: [])
            promise.resolve(json)
          } catch {
            promise.reject("ERR_MUSIC_KIT", error.localizedDescription)
          }
        }
      } else {
        promise.reject("ERR_OS_VERSION", "iOS 15.0 or higher is required for MusicKit")
      }
    }
    
    // --- Get Catalog Songs (for genre data) ---
    AsyncFunction("getCatalogSongs") { (songIds: [String]?, promise: Promise) in
      if #available(iOS 15.0, *) {
        Task {
          do {
            let status = await MusicAuthorization.request()
            guard status == .authorized else {
              promise.reject("ERR_AUTH", "Not authorized")
              return
            }
            
            guard let ids = songIds, !ids.isEmpty else {
              promise.resolve(["data": []])
              return
            }
            
            // Limit to 100 IDs per request (Apple Music API limit)
            let limitedIds = Array(ids.prefix(100))
            let idsString = limitedIds.joined(separator: ",")
            
            let url = URL(string: "https://api.music.apple.com/v1/catalog/\(self.userStorefront)/songs")!
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = [
              URLQueryItem(name: "ids", value: idsString),
              URLQueryItem(name: "include", value: "genres,artists")
            ]
            
            guard let requestUrl = components.url else {
              promise.reject("ERR_URL", "Invalid URL")
              return
            }

            let request = MusicDataRequest(urlRequest: URLRequest(url: requestUrl))
            let response = try await request.response()
            
            let json = try JSONSerialization.jsonObject(with: response.data, options: [])
            promise.resolve(json)
          } catch {
            promise.reject("ERR_MUSIC_KIT", error.localizedDescription)
          }
        }
      } else {
        promise.reject("ERR_OS_VERSION", "iOS 15.0 or higher is required for MusicKit")
      }
    }
    
    // --- Get Catalog Artists (for genre data) ---
    AsyncFunction("getCatalogArtists") { (artistIds: [String]?, promise: Promise) in
      if #available(iOS 15.0, *) {
        Task {
          do {
            let status = await MusicAuthorization.request()
            guard status == .authorized else {
              promise.reject("ERR_AUTH", "Not authorized")
              return
            }
            
            guard let ids = artistIds, !ids.isEmpty else {
              promise.resolve(["data": []])
              return
            }
            
            // Limit to 25 IDs per request for artists
            let limitedIds = Array(ids.prefix(25))
            let idsString = limitedIds.joined(separator: ",")
            
            let url = URL(string: "https://api.music.apple.com/v1/catalog/\(self.userStorefront)/artists")!
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = [
              URLQueryItem(name: "ids", value: idsString),
              URLQueryItem(name: "include", value: "genres")
            ]
            
            guard let requestUrl = components.url else {
              promise.reject("ERR_URL", "Invalid URL")
              return
            }

            let request = MusicDataRequest(urlRequest: URLRequest(url: requestUrl))
            let response = try await request.response()
            
            let json = try JSONSerialization.jsonObject(with: response.data, options: [])
            promise.resolve(json)
          } catch {
            promise.reject("ERR_MUSIC_KIT", error.localizedDescription)
          }
        }
      } else {
        promise.reject("ERR_OS_VERSION", "iOS 15.0 or higher is required for MusicKit")
      }
    }
    
    // --- Get User Storefront ---
    AsyncFunction("getUserStorefront") { (promise: Promise) in
      if #available(iOS 15.0, *) {
        Task {
          do {
            let status = await MusicAuthorization.request()
            guard status == .authorized else {
              promise.reject("ERR_AUTH", "Not authorized")
              return
            }
            
            await self.fetchUserStorefront()
            promise.resolve(self.userStorefront)
          } catch {
            promise.reject("ERR_MUSIC_KIT", error.localizedDescription)
          }
        }
      } else {
        promise.reject("ERR_OS_VERSION", "iOS 15.0 or higher is required for MusicKit")
      }
    }
    
    // --- Fetch All User Music Data (Combined endpoint for efficiency) ---
    AsyncFunction("fetchUserMusicData") { (options: [String: Any]?, promise: Promise) in
      if #available(iOS 15.0, *) {
        Task {
          do {
            let status = await MusicAuthorization.request()
            guard status == .authorized else {
              promise.reject("ERR_AUTH", "Not authorized")
              return
            }
            
            let limit = (options?["limit"] as? Int) ?? 50
            let includeGenres = (options?["includeGenres"] as? Bool) ?? true
            
            var result: [String: Any] = [:]
            var allTracks: [[String: Any]] = []
            var allArtists: [[String: Any]] = []
            var allAlbums: [[String: Any]] = []
            
            // 1. Fetch Heavy Rotation
            if let heavyRotationData = try? await self.fetchHeavyRotation(limit: limit) {
              if let data = heavyRotationData["data"] as? [[String: Any]] {
                // Extract albums and artists from heavy rotation
                for item in data {
                  if let type = item["type"] as? String {
                    if type == "albums" || type == "library-albums" {
                      allAlbums.append(self.parseAlbum(item))
                    } else if type == "artists" || type == "library-artists" {
                      allArtists.append(self.parseArtist(item))
                    }
                  }
                }
              }
            }
            
            // 2. Fetch Recently Played Tracks
            if let recentData = try? await self.fetchRecentlyPlayed(limit: limit) {
              if let data = recentData["data"] as? [[String: Any]] {
                for item in data {
                  let track = self.parseTrack(item)
                  allTracks.append(track)
                  
                  // Extract artist from track
                  if let attributes = item["attributes"] as? [String: Any],
                     let artistName = attributes["artistName"] as? String {
                    let artistId = (item["relationships"] as? [String: Any])?["artists"]?["data"]?[0]?["id"] as? String ?? ""
                    if !allArtists.contains(where: { ($0["name"] as? String) == artistName }) {
                      allArtists.append([
                        "id": artistId,
                        "name": artistName,
                        "genres": [],
                        "images": [],
                        "popularity": 0,
                        "uri": "apple-music:artist:\(artistId.isEmpty ? artistName : artistId)"
                      ])
                    }
                  }
                  
                  // Extract album from track
                  if let attributes = item["attributes"] as? [String: Any],
                     let albumName = attributes["albumName"] as? String {
                    let albumId = (item["relationships"] as? [String: Any])?["albums"]?["data"]?[0]?["id"] as? String ?? ""
                    if !allAlbums.contains(where: { ($0["name"] as? String) == albumName }) {
                      var albumImages: [[String: Any]] = []
                      if let artwork = attributes["artwork"] as? [String: Any],
                         let url = artwork["url"] as? String {
                        let formattedUrl = url.replacingOccurrences(of: "{w}", with: "300")
                                              .replacingOccurrences(of: "{h}", with: "300")
                        albumImages.append(["url": formattedUrl, "height": 300, "width": 300])
                      }
                      allAlbums.append([
                        "id": albumId,
                        "name": albumName,
                        "artists": [["id": "", "name": attributes["artistName"] as? String ?? ""]],
                        "images": albumImages,
                        "uri": "apple-music:album:\(albumId)"
                      ])
                    }
                  }
                }
              }
            }
            
            // 3. Fetch Genre Data from Catalog (if includeGenres is true)
            if includeGenres && !allTracks.isEmpty {
              // Get catalog song IDs (filter out library IDs)
              let catalogSongIds = allTracks.compactMap { track -> String? in
                guard let id = track["id"] as? String,
                      !id.hasPrefix("i.") else { return nil }
                return id
              }.prefix(50)
              
              if !catalogSongIds.isEmpty {
                if let catalogData = try? await self.fetchCatalogSongs(ids: Array(catalogSongIds)) {
                  if let data = catalogData["data"] as? [[String: Any]] {
                    // Create lookup map
                    var catalogMap: [String: [String]] = [:]
                    for song in data {
                      if let id = song["id"] as? String,
                         let attributes = song["attributes"] as? [String: Any],
                         let genreNames = attributes["genreNames"] as? [String] {
                        catalogMap[id] = genreNames
                      }
                    }
                    
                    // Enrich tracks with genre data
                    allTracks = allTracks.map { track in
                      var mutableTrack = track
                      if let id = track["id"] as? String,
                         let genres = catalogMap[id] {
                        mutableTrack["genreNames"] = genres
                      }
                      return mutableTrack
                    }
                  }
                }
              }
              
              // Get artist genres
              let artistIds = allArtists.compactMap { artist -> String? in
                guard let id = artist["id"] as? String,
                      !id.isEmpty,
                      !id.hasPrefix("i.") else { return nil }
                return id
              }.prefix(25)
              
              if !artistIds.isEmpty {
                if let artistData = try? await self.fetchCatalogArtists(ids: Array(artistIds)) {
                  if let data = artistData["data"] as? [[String: Any]] {
                    for catalogArtist in data {
                      if let id = catalogArtist["id"] as? String,
                         let attributes = catalogArtist["attributes"] as? [String: Any],
                         let genreNames = attributes["genreNames"] as? [String] {
                        // Update artist in allArtists
                        if let index = allArtists.firstIndex(where: { ($0["id"] as? String) == id }) {
                          allArtists[index]["genres"] = genreNames
                        }
                      }
                    }
                  }
                }
              }
            }
            
            result["tracks"] = allTracks
            result["artists"] = allArtists
            result["albums"] = allAlbums
            
            promise.resolve(result)
          } catch {
            promise.reject("ERR_MUSIC_KIT", error.localizedDescription)
          }
        }
      } else {
        promise.reject("ERR_OS_VERSION", "iOS 15.0 or higher is required for MusicKit")
      }
    }
  }
  
  // MARK: - Private Helper Methods
  
  @available(iOS 15.0, *)
  private func fetchUserStorefront() async {
    do {
      let url = URL(string: "https://api.music.apple.com/v1/me/storefront")!
      let request = MusicDataRequest(urlRequest: URLRequest(url: url))
      let response = try await request.response()
      
      if let json = try? JSONSerialization.jsonObject(with: response.data, options: []) as? [String: Any],
         let data = json["data"] as? [[String: Any]],
         let first = data.first,
         let id = first["id"] as? String {
        self.userStorefront = id
        print("[VybrAppleMusic] User storefront: \(self.userStorefront)")
      }
    } catch {
      print("[VybrAppleMusic] Error fetching storefront: \(error.localizedDescription)")
    }
  }
  
  @available(iOS 15.0, *)
  private func fetchHeavyRotation(limit: Int) async throws -> [String: Any] {
    let url = URL(string: "https://api.music.apple.com/v1/me/history/heavy-rotation")!
    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
    components.queryItems = [URLQueryItem(name: "limit", value: String(limit))]
    
    guard let requestUrl = components.url else {
      throw NSError(domain: "VybrAppleMusic", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
    }
    
    let request = MusicDataRequest(urlRequest: URLRequest(url: requestUrl))
    let response = try await request.response()
    
    return try JSONSerialization.jsonObject(with: response.data, options: []) as? [String: Any] ?? [:]
  }
  
  @available(iOS 15.0, *)
  private func fetchRecentlyPlayed(limit: Int) async throws -> [String: Any] {
    let url = URL(string: "https://api.music.apple.com/v1/me/recent/played/tracks")!
    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
    components.queryItems = [URLQueryItem(name: "limit", value: String(limit))]
    
    guard let requestUrl = components.url else {
      throw NSError(domain: "VybrAppleMusic", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
    }
    
    let request = MusicDataRequest(urlRequest: URLRequest(url: requestUrl))
    let response = try await request.response()
    
    return try JSONSerialization.jsonObject(with: response.data, options: []) as? [String: Any] ?? [:]
  }
  
  @available(iOS 15.0, *)
  private func fetchCatalogSongs(ids: [String]) async throws -> [String: Any] {
    let idsString = ids.joined(separator: ",")
    let url = URL(string: "https://api.music.apple.com/v1/catalog/\(userStorefront)/songs")!
    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
    components.queryItems = [
      URLQueryItem(name: "ids", value: idsString),
      URLQueryItem(name: "include", value: "genres,artists")
    ]
    
    guard let requestUrl = components.url else {
      throw NSError(domain: "VybrAppleMusic", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
    }
    
    let request = MusicDataRequest(urlRequest: URLRequest(url: requestUrl))
    let response = try await request.response()
    
    return try JSONSerialization.jsonObject(with: response.data, options: []) as? [String: Any] ?? [:]
  }
  
  @available(iOS 15.0, *)
  private func fetchCatalogArtists(ids: [String]) async throws -> [String: Any] {
    let idsString = ids.joined(separator: ",")
    let url = URL(string: "https://api.music.apple.com/v1/catalog/\(userStorefront)/artists")!
    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
    components.queryItems = [
      URLQueryItem(name: "ids", value: idsString),
      URLQueryItem(name: "include", value: "genres")
    ]
    
    guard let requestUrl = components.url else {
      throw NSError(domain: "VybrAppleMusic", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
    }
    
    let request = MusicDataRequest(urlRequest: URLRequest(url: requestUrl))
    let response = try await request.response()
    
    return try JSONSerialization.jsonObject(with: response.data, options: []) as? [String: Any] ?? [:]
  }
  
  // MARK: - Parsing Helpers
  
  private func parseTrack(_ item: [String: Any]) -> [String: Any] {
    let attributes = item["attributes"] as? [String: Any] ?? [:]
    let relationships = item["relationships"] as? [String: Any] ?? [:]
    
    var images: [[String: Any]] = []
    if let artwork = attributes["artwork"] as? [String: Any],
       let url = artwork["url"] as? String {
      let formattedUrl = url.replacingOccurrences(of: "{w}", with: "300")
                            .replacingOccurrences(of: "{h}", with: "300")
      images.append(["url": formattedUrl, "height": 300, "width": 300])
    }
    
    let albumId = (relationships["albums"] as? [String: Any])?["data"] as? [[String: Any]]
    let firstAlbumId = albumId?.first?["id"] as? String ?? ""
    
    let artistId = (relationships["artists"] as? [String: Any])?["data"] as? [[String: Any]]
    let firstArtistId = artistId?.first?["id"] as? String ?? ""
    
    return [
      "id": item["id"] as? String ?? "",
      "name": attributes["name"] as? String ?? "Unknown Track",
      "uri": "apple-music:song:\(item["id"] as? String ?? "")",
      "album": [
        "id": firstAlbumId,
        "name": attributes["albumName"] as? String ?? "",
        "images": images
      ],
      "artists": [[
        "id": firstArtistId,
        "name": attributes["artistName"] as? String ?? ""
      ]],
      "popularity": 0,
      "genreNames": attributes["genreNames"] as? [String] ?? []
    ]
  }
  
  private func parseArtist(_ item: [String: Any]) -> [String: Any] {
    let attributes = item["attributes"] as? [String: Any] ?? [:]
    
    var images: [[String: Any]] = []
    if let artwork = attributes["artwork"] as? [String: Any],
       let url = artwork["url"] as? String {
      let formattedUrl = url.replacingOccurrences(of: "{w}", with: "300")
                            .replacingOccurrences(of: "{h}", with: "300")
      images.append(["url": formattedUrl, "height": 300, "width": 300])
    }
    
    return [
      "id": item["id"] as? String ?? "",
      "name": attributes["name"] as? String ?? "Unknown Artist",
      "genres": attributes["genreNames"] as? [String] ?? [],
      "images": images,
      "popularity": 0,
      "uri": "apple-music:artist:\(item["id"] as? String ?? "")"
    ]
  }
  
  private func parseAlbum(_ item: [String: Any]) -> [String: Any] {
    let attributes = item["attributes"] as? [String: Any] ?? [:]
    
    var images: [[String: Any]] = []
    if let artwork = attributes["artwork"] as? [String: Any],
       let url = artwork["url"] as? String {
      let formattedUrl = url.replacingOccurrences(of: "{w}", with: "300")
                            .replacingOccurrences(of: "{h}", with: "300")
      images.append(["url": formattedUrl, "height": 300, "width": 300])
    }
    
    return [
      "id": item["id"] as? String ?? "",
      "name": attributes["name"] as? String ?? "Unknown Album",
      "artists": [[
        "id": "",
        "name": attributes["artistName"] as? String ?? ""
      ]],
      "images": images,
      "uri": "apple-music:album:\(item["id"] as? String ?? "")"
    ]
  }
}
